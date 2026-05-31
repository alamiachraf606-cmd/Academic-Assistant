const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:3001"
    : "http://127.0.0.1:3001";

const connectButton = document.getElementById("connect");
const announcements = document.getElementById("announcements");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatOutput = document.getElementById("chat-output");
const verifyButton = document.getElementById("verify");
const verifyResult = document.getElementById("verify-result");
const docIdInput = document.getElementById("doc-id");

const config = {
  chainId: null
};

connectButton.addEventListener("click", async () => {
  if (!window.ethereum) {
    alert("MetaMask not found");
    return;
  }
  await window.ethereum.request({ method: "eth_requestAccounts" });
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = chatInput.value.trim();
  if (!query) return;

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });

    const data = await res.json();
    if (data.error) {
      chatOutput.textContent = `Error: ${data.error}`;
      return;
    }

    const lines = [data.answer ?? "No response."];
    if (Array.isArray(data.sources) && data.sources.length) {
      lines.push("", "Sources:");
      data.sources.forEach((source) => {
        const time = source.timestamp
          ? new Date(source.timestamp * 1000).toLocaleString()
          : "";
        lines.push(
          `- #${source.id} ${source.category} (${source.targetGroup}) ${time}`
        );
        if (source.excerpt) {
          lines.push(`  ${source.excerpt}`);
        }
      });
    }

    chatOutput.textContent = lines.join("\n");
  } catch {
    chatOutput.textContent = "Chat service unavailable.";
  }
});

verifyButton.addEventListener("click", async () => {
  const id = docIdInput.value.trim();
  const file = document.getElementById("file-input").files?.[0];
  if (!id || !file) {
    verifyResult.textContent = "Document ID and file required.";
    return;
  }

  const fileHash = await hashFile(file);
  try {
    const res = await fetch(`${API_BASE}/api/document/verify/${id}?hash=${fileHash}`);
    const data = await res.json();
    verifyResult.textContent = data.ok ? "Verified" : "Mismatch";
  } catch {
    verifyResult.textContent = "Verification failed";
  }
});

function renderAnnouncementList(items) {
  if (!items.length) {
    announcements.textContent = "No announcements yet.";
    return;
  }

  const shortHash = (hash) => `${hash.slice(0, 10)}...${hash.slice(-8)}`;

  announcements.innerHTML = items
    .map((item) => {
      const time = new Date(Number(item.timestamp) * 1000).toLocaleString();
      return `
        <article class="announcement-card">
          <div class="announcement-title">
            <span>${item.category}</span>
            <span class="tag">${item.targetGroup}</span>
          </div>
          <div class="announcement-row">
            <span>Published ${time}</span>
            <span>Publisher ${item.publisher.slice(0, 10)}...</span>
          </div>
          <div class="announcement-hash">${shortHash(item.contentHash)}</div>
          <div class="announcement-actions">
            <button class="ghost-button" data-ack="${item.id}">I've read this</button>
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadAnnouncements() {
  try {
    const res = await fetch(`${API_BASE}/api/announcements`);
    const data = await res.json();
    renderAnnouncementList(data.items ?? []);
  } catch {
    announcements.textContent = "Backend not reachable";
  }
}

loadAnnouncements();

async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `0x${hashHex}`;
}

async function loadConfig() {
  try {
    const res = await fetch(`${API_BASE}/api/config`);
    const data = await res.json();
    config.chainId = data.chainId;
  } catch {
    config.chainId = null;
  }
}

announcements.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;
  const id = target.dataset.ack;
  if (!id) return;

  try {
    const res = await fetch(`${API_BASE}/api/acknowledge/${id}`, {
      method: "POST"
    });
    const data = await res.json();
    if (!data.ok) {
      const message = data.error ?? "Acknowledgment failed";
      if (message.includes("ALREADY_ACKED")) {
        target.textContent = "Acknowledged";
        target.disabled = true;
        return;
      }
      throw new Error(message);
    }
    target.textContent = "Acknowledged";
    target.disabled = true;
  } catch (error) {
    alert(`Acknowledgment failed: ${String((error && error.message) || error)}`);
    console.error(error);
  }
});

loadConfig();
