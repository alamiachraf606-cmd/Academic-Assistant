import crypto from "crypto";
import express from "express";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  parseAbiItem,
  parseEther
} from "viem";
import { hardhat } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

dotenv.config();

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  const allowedOrigins = new Set(["http://127.0.0.1:5173", "http://localhost:5173"]);
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const chainId = process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : hardhat.id;
const operatorKey = process.env.OPERATOR_PRIVATE_KEY;
const studentKey = process.env.STUDENT_PRIVATE_KEY;
const ollamaUrl = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const ollamaModel = process.env.OLLAMA_MODEL ?? "llama3.1:8b";
const roleManagerAddress = process.env.ROLE_MANAGER_ADDRESS;
const announcementLogAddress = process.env.ANNOUNCEMENT_LOG_ADDRESS;
const documentRegistryAddress = process.env.DOCUMENT_REGISTRY_ADDRESS;
const acknowledgmentLogAddress = process.env.ACKNOWLEDGMENT_LOG_ADDRESS;

const account = operatorKey ? privateKeyToAccount(operatorKey as `0x${string}`) : null;
const studentAccount = studentKey ? privateKeyToAccount(studentKey as `0x${string}`) : null;

const publicClient = createPublicClient({
  chain: { ...hardhat, id: chainId },
  transport: http(rpcUrl)
});

const walletClient = account
  ? createWalletClient({
      account,
      chain: { ...hardhat, id: chainId },
      transport: http(rpcUrl)
    })
  : null;

const studentWalletClient = studentAccount
  ? createWalletClient({
      account: studentAccount,
      chain: { ...hardhat, id: chainId },
      transport: http(rpcUrl)
    })
  : null;

const announcementAbi = [
  {
    type: "function",
    name: "publish",
    stateMutability: "nonpayable",
    inputs: [
      { name: "contentHash", type: "bytes32" },
      { name: "category", type: "string" },
      { name: "targetGroup", type: "string" }
    ],
    outputs: [{ name: "id", type: "uint256" }]
  },
  {
    type: "function",
    name: "verify",
    stateMutability: "view",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "contentHash", type: "bytes32" }
    ],
    outputs: [{ name: "ok", type: "bool" }]
  },
  {
    type: "function",
    name: "announcementCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "count", type: "uint256" }]
  },
  {
    type: "function",
    name: "getAnnouncement",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      {
        name: "announcement",
        type: "tuple",
        components: [
          { name: "contentHash", type: "bytes32" },
          { name: "category", type: "string" },
          { name: "targetGroup", type: "string" },
          { name: "timestamp", type: "uint256" },
          { name: "publisher", type: "address" }
        ]
      }
    ]
  }
];

const documentAbi = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [
      { name: "fileHash", type: "bytes32" },
      { name: "fileName", type: "string" },
      { name: "targetGroup", type: "string" }
    ],
    outputs: [{ name: "id", type: "uint256" }]
  },
  {
    type: "function",
    name: "verifyDocument",
    stateMutability: "view",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "fileHash", type: "bytes32" }
    ],
    outputs: [{ name: "ok", type: "bool" }]
  },
  {
    type: "function",
    name: "documentCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "count", type: "uint256" }]
  },
  {
    type: "function",
    name: "getDocument",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      {
        name: "document",
        type: "tuple",
        components: [
          { name: "fileHash", type: "bytes32" },
          { name: "fileName", type: "string" },
          { name: "targetGroup", type: "string" },
          { name: "timestamp", type: "uint256" },
          { name: "publisher", type: "address" }
        ]
      }
    ]
  }
];

const acknowledgmentAbi = [
  {
    type: "function",
    name: "acknowledge",
    stateMutability: "nonpayable",
    inputs: [{ name: "announcementId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "getAcknowledgedAt",
    stateMutability: "view",
    inputs: [
      { name: "announcementId", type: "uint256" },
      { name: "student", type: "address" }
    ],
    outputs: [{ name: "timestamp", type: "uint256" }]
  }
];

const roleManagerAbi = [
  {
    type: "function",
    name: "getGroup",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "group", type: "string" }]
  }
];

type CachedAnnouncement = {
  id: number;
  content: string;
  contentHash: string;
  category: string;
  targetGroup: string;
  timestamp: number;
  publisher: string;
};

const cachePath = path.join(process.cwd(), "data", "announcement-cache.json");
let announcementCache: CachedAnnouncement[] = [];

async function loadAnnouncementCache() {
  try {
    const raw = await fs.readFile(cachePath, "utf8");
    const parsed = JSON.parse(raw) as { items?: CachedAnnouncement[] };
    announcementCache = Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    announcementCache = [];
  }
}

async function saveAnnouncementCache() {
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  const payload = JSON.stringify({ items: announcementCache }, null, 2);
  await fs.writeFile(cachePath, payload, "utf8");
}

function upsertAnnouncementCache(entry: CachedAnnouncement) {
  const existingIndex = announcementCache.findIndex((item) => item.id === entry.id);
  if (existingIndex >= 0) {
    announcementCache[existingIndex] = entry;
  } else {
    announcementCache = [...announcementCache, entry].sort((a, b) => a.id - b.id);
  }
}

function requireEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

function hashContent(value: string) {
  return `0x${crypto.createHash("sha256").update(value).digest("hex")}` as const;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/config", (_req, res) => {
  res.json({
    chainId,
    roleManagerAddress,
    announcementLogAddress,
    documentRegistryAddress,
    acknowledgmentLogAddress
  });
});

// Announcements
app.post("/api/announcement", async (req, res) => {
  try {
    if (!walletClient || !account) {
      res.status(500).json({ error: "Operator wallet not configured" });
      return;
    }

    const announcementAddress = requireEnv(announcementLogAddress, "ANNOUNCEMENT_LOG_ADDRESS");
    const { content, category, group } = req.body as {
      content?: string;
      category?: string;
      group?: string;
    };

    if (!content || !category || !group) {
      res.status(400).json({ error: "content, category, group required" });
      return;
    }

    const hash = hashContent(content);
    const txHash = await walletClient.writeContract({
      address: announcementAddress as `0x${string}`,
      abi: announcementAbi,
      functionName: "publish",
      args: [hash, category, group],
      account
    });

    await publicClient.waitForTransactionReceipt({ hash: txHash });

    const count = await publicClient.readContract({
      address: announcementAddress as `0x${string}`,
      abi: announcementAbi,
      functionName: "announcementCount"
    });

    const id = Number(count as bigint);
    const announcement = await publicClient.readContract({
      address: announcementAddress as `0x${string}`,
      abi: announcementAbi,
      functionName: "getAnnouncement",
      args: [BigInt(id)]
    });

    const { timestamp, publisher } = announcement as {
      timestamp: bigint;
      publisher: string;
    };

    const cachedEntry: CachedAnnouncement = {
      id,
      content,
      contentHash: hash,
      category,
      targetGroup: group,
      timestamp: Number(timestamp),
      publisher
    };

    upsertAnnouncementCache(cachedEntry);
    await saveAnnouncementCache();

    res.json({ ok: true, txHash, hash, id });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get("/api/announcements", async (req, res) => {
  try {
    const announcementAddress = requireEnv(announcementLogAddress, "ANNOUNCEMENT_LOG_ADDRESS");
    const roleAddress = requireEnv(roleManagerAddress, "ROLE_MANAGER_ADDRESS");
    const addressParam = typeof req.query.address === "string" ? req.query.address : null;

    const viewerGroup = addressParam && isAddress(addressParam)
      ? await publicClient.readContract({
          address: roleAddress as `0x${string}`,
          abi: roleManagerAbi,
          functionName: "getGroup",
          args: [addressParam]
        })
      : "";

    const count = await publicClient.readContract({
      address: announcementAddress as `0x${string}`,
      abi: announcementAbi,
      functionName: "announcementCount"
    });

    const result = [] as Array<{
      id: number;
      contentHash: string;
      category: string;
      targetGroup: string;
      timestamp: string;
      publisher: string;
    }>;

    for (let i = 1n; i <= (count as bigint); i += 1n) {
      const announcement = await publicClient.readContract({
        address: announcementAddress as `0x${string}`,
        abi: announcementAbi,
        functionName: "getAnnouncement",
        args: [i]
      });

      const { contentHash, category, targetGroup, timestamp, publisher } =
        announcement as {
          contentHash: string;
          category: string;
          targetGroup: string;
          timestamp: bigint;
          publisher: string;
        };

      const allowed =
        !viewerGroup || targetGroup === "all" || targetGroup === viewerGroup;

      if (allowed) {
        result.push({
          id: Number(i),
          contentHash,
          category,
          targetGroup,
          timestamp: timestamp.toString(),
          publisher
        });
      }
    }

    res.json({ count: result.length, items: result });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Documents
app.post("/api/document", async (req, res) => {
  try {
    if (!walletClient || !account) {
      res.status(500).json({ error: "Operator wallet not configured" });
      return;
    }

    const registryAddress = requireEnv(documentRegistryAddress, "DOCUMENT_REGISTRY_ADDRESS");
    const { fileName, fileHash, group } = req.body as {
      fileName?: string;
      fileHash?: string;
      group?: string;
    };

    if (!fileName || !fileHash || !group) {
      res.status(400).json({ error: "fileName, fileHash, group required" });
      return;
    }

    const count = await publicClient.readContract({
      address: registryAddress as `0x${string}`,
      abi: documentAbi,
      functionName: "documentCount"
    });
    const nextId = Number(count as bigint) + 1;

    const txHash = await walletClient.writeContract({
      address: registryAddress as `0x${string}`,
      abi: documentAbi,
      functionName: "register",
      args: [fileHash, fileName, group],
      account
    });

    res.json({ ok: true, txHash, id: nextId });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get("/api/documents", async (_req, res) => {
  try {
    const registryAddress = requireEnv(documentRegistryAddress, "DOCUMENT_REGISTRY_ADDRESS");
    const count = await publicClient.readContract({
      address: registryAddress as `0x${string}`,
      abi: documentAbi,
      functionName: "documentCount"
    });

    const items = [] as Array<{
      id: number;
      fileHash: string;
      fileName: string;
      targetGroup: string;
      timestamp: string;
      publisher: string;
    }>;

    for (let i = 1n; i <= (count as bigint); i += 1n) {
      const document = await publicClient.readContract({
        address: registryAddress as `0x${string}`,
        abi: documentAbi,
        functionName: "getDocument",
        args: [i]
      });

      const { fileHash, fileName, targetGroup, timestamp, publisher } =
        document as {
          fileHash: string;
          fileName: string;
          targetGroup: string;
          timestamp: bigint;
          publisher: string;
        };

      items.push({
        id: Number(i),
        fileHash,
        fileName,
        targetGroup,
        timestamp: timestamp.toString(),
        publisher
      });
    }

    res.json({ count: items.length, items });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get("/api/document/verify/:id", async (req, res) => {
  try {
    const registryAddress = requireEnv(documentRegistryAddress, "DOCUMENT_REGISTRY_ADDRESS");
    const id = Number(req.params.id);
    const hash = typeof req.query.hash === "string" ? req.query.hash : null;

    if (!Number.isFinite(id) || !hash) {
      res.status(400).json({ error: "id and hash query required" });
      return;
    }

    const ok = await publicClient.readContract({
      address: registryAddress as `0x${string}`,
      abi: documentAbi,
      functionName: "verifyDocument",
      args: [BigInt(id), hash as `0x${string}`]
    });

    res.json({ ok });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

function tokenize(value: string) {
  return value
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter(Boolean) ?? [];
}

function buildExcerpt(content: string, queryTokens: string[]) {
  if (!content) return "";
  const lower = content.toLowerCase();
  for (const token of queryTokens) {
    const index = lower.indexOf(token);
    if (index >= 0) {
      const start = Math.max(0, index - 40);
      const end = Math.min(content.length, index + 140);
      const snippet = content.slice(start, end).trim();
      return snippet.length < content.length ? `...${snippet}...` : snippet;
    }
  }
  return content.length > 160 ? `${content.slice(0, 160).trim()}...` : content;
}

async function requestOllama(prompt: string) {
  const res = await fetch(`${ollamaUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: ollamaModel, prompt, stream: false })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { response?: string };
  return data.response?.trim() ?? "";
}

// Chat (lightweight retrieval from cached announcements)
app.post("/api/chat", async (req, res) => {
  const { query, group } = req.body as { query?: string; group?: string };
  const cleanedQuery = query?.trim();
  if (!cleanedQuery) {
    res.status(400).json({ error: "query required" });
    return;
  }

  // Lightweight greeting fallback: respond to simple salutations without
  // consulting the announcement index or LLM so the UI feels responsive.
  const lc = cleanedQuery.toLowerCase();
  const greetings = ["hi", "hello", "hey", "good morning", "good afternoon", "good evening"]; 
  if (greetings.includes(lc) || /^hi\b|^hello\b|^hey\b/.test(lc)) {
    res.json({
      answer:
        "Hello — I'm the course assistant. I answer questions using verified on-chain announcements. Try asking about a specific announcement or topic (e.g. 'When is the midterm?')."
    });
    return;
  }

  const groupFilter = group?.trim();
  const tokens = tokenize(cleanedQuery);

  const idMatch = cleanedQuery.match(/announcement\s*#?\s*(\d+)/i);
  if (idMatch) {
    const id = Number(idMatch[1]);
    const item = announcementCache.find((entry) => entry.id === id);
    if (!item) {
      res.json({
        answer: `I do not have cached content for announcement #${id} yet.`
      });
      return;
    }

    res.json({
      answer: item.content,
      sources: [
        {
          id: item.id,
          category: item.category,
          targetGroup: item.targetGroup,
          timestamp: item.timestamp,
          contentHash: item.contentHash,
          excerpt: buildExcerpt(item.content, tokens)
        }
      ]
    });
    return;
  }

  const candidates = announcementCache.filter((entry) => {
    if (!groupFilter) return true;
    return entry.targetGroup === "all" || entry.targetGroup === groupFilter;
  });

  if (!candidates.length) {
    res.json({
      answer:
        "I do not have cached announcements yet. Ask your professor to publish at least one announcement in this session."
    });
    return;
  }

  const scored = candidates
    .map((entry) => {
      const haystack = `${entry.content} ${entry.category} ${entry.targetGroup}`.toLowerCase();
      const score = tokens.reduce((total, token) =>
        haystack.includes(token) ? total + 1 : total, 0);
      return { entry, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.entry.timestamp - a.entry.timestamp)
    .slice(0, 3);

  if (!scored.length) {
    res.json({
      answer:
        "I could not find a matching announcement. Try keywords from the announcement text or ask the professor to publish more details."
    });
    return;
  }

  const sources = scored.map(({ entry }) => ({
    id: entry.id,
    category: entry.category,
    targetGroup: entry.targetGroup,
    timestamp: entry.timestamp,
    contentHash: entry.contentHash,
    excerpt: buildExcerpt(entry.content, tokens)
  }));

  const context = scored
    .map(({ entry }) =>
      `#${entry.id} | ${entry.category} | ${entry.targetGroup}\n${entry.content}`
    )
    .join("\n\n");

  const prompt = [
    "You are the course assistant.",
    "Answer ONLY using the announcements provided in the context.",
    "If the answer is not in the context, say: I do not have that information yet.",
    "Keep the answer concise.",
    "",
    `Question: ${cleanedQuery}`,
    "",
    "Context:",
    context
  ].join("\n");

  let answer = "";
  try {
    answer = await requestOllama(prompt);
  } catch (error) {
    console.error("Ollama request failed", error);
    answer = sources.map((source) => source.excerpt).join("\n\n");
  }

  res.json({ answer, sources, model: ollamaModel });
});

// Acknowledgments
app.post("/api/acknowledge/:id", async (req, res) => {
  try {
    if (!studentWalletClient || !studentAccount) {
      res.status(500).json({ error: "Student wallet not configured" });
      return;
    }

    const acknowledgmentAddress = requireEnv(
      acknowledgmentLogAddress,
      "ACKNOWLEDGMENT_LOG_ADDRESS"
    );
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid announcement id" });
      return;
    }

    const txHash = await studentWalletClient.writeContract({
      address: acknowledgmentAddress as `0x${string}`,
      abi: acknowledgmentAbi,
      functionName: "acknowledge",
      args: [BigInt(id)],
      account: studentAccount,
      value: parseEther("0")
    });

    res.json({ ok: true, txHash });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Verify
app.get("/api/verify/:id", async (req, res) => {
  try {
    const announcementAddress = requireEnv(announcementLogAddress, "ANNOUNCEMENT_LOG_ADDRESS");
    const id = Number(req.params.id);
    const hash = typeof req.query.hash === "string" ? req.query.hash : null;

    if (!Number.isFinite(id) || !hash) {
      res.status(400).json({ error: "id and hash query required" });
      return;
    }

    const ok = await publicClient.readContract({
      address: announcementAddress as `0x${string}`,
      abi: announcementAbi,
      functionName: "verify",
      args: [BigInt(id), hash as `0x${string}`]
    });

    res.json({ ok });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get("/api/acknowledgments", async (_req, res) => {
  try {
    const acknowledgmentAddress = requireEnv(
      acknowledgmentLogAddress,
      "ACKNOWLEDGMENT_LOG_ADDRESS"
    );

    const logs = await publicClient.getLogs({
      address: acknowledgmentAddress as `0x${string}`,
      event: parseAbiItem(
        "event Acknowledged(uint256 indexed announcementId, address indexed student, uint256 timestamp)"
      ),
      fromBlock: 0n,
      toBlock: "latest"
    });

    const items = logs.map((log) => ({
      announcementId: Number(log.args.announcementId),
      student: log.args.student,
      timestamp: Number(log.args.timestamp)
    }));

    res.json({ count: items.length, items });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

const port = process.env.PORT ? Number(process.env.PORT) : 3001;
loadAnnouncementCache().catch((error) => {
  console.error("Failed to load announcement cache", error);
});
app.listen(port, "0.0.0.0", () => {
  console.log(`Backend listening on http://0.0.0.0:${port}`);
});
