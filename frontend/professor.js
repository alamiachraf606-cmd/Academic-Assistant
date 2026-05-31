const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:3001"
    : "http://127.0.0.1:3001";
const connectButton = document.getElementById("connect");
const publishForm = document.getElementById("publish-form");
const uploadButton = document.getElementById("upload");
const docStatus = document.getElementById("doc-status");
const ackLog = document.getElementById("ack-log");
const docList = document.getElementById("doc-list");

connectButton.addEventListener("click", async () => {
  if (!window.ethereum) {
    alert("MetaMask not found");
    return;
  }
  await window.ethereum.request({ method: "eth_requestAccounts" });
});

publishForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const category = document.getElementById("category").value;
  const group = document.getElementById("group").value;
  const content = document.getElementById("content").value;

  await fetch(`${API_BASE}/api/announcement`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, group, content })
  });
});

uploadButton.addEventListener("click", async () => {
  const file = document.getElementById("doc-file").files?.[0];
  const group = document.getElementById("doc-group").value;
  if (!file || !group) {
    docStatus.textContent = "File and group required.";
    return;
  }

  const fileHash = await hashFile(file);
  try {
    const res = await fetch(`${API_BASE}/api/document`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, fileHash, group })
    });

    const data = await res.json();
    docStatus.textContent = data.ok
      ? `Registered document #${data.id}`
      : data.error ?? "Registration failed";
  } catch {
    docStatus.textContent = "Registration failed";
  }
});

async function loadDocuments() {
  try {
    const res = await fetch(`${API_BASE}/api/documents`);
    const data = await res.json();
    if (!data.items || !data.items.length) {
      docList.textContent = "No documents yet.";
      return;
    }

    docList.innerHTML = data.items
      .map((item) => {
        const time = new Date(Number(item.timestamp) * 1000).toLocaleString();
        return `
          <div class="ack-item">
            <strong>#${item.id} ${item.fileName}</strong>
            <div class="ack-meta">Group ${item.targetGroup}</div>
            <div class="ack-meta">Published ${time}</div>
            <div class="ack-meta">Hash ${item.fileHash.slice(0, 10)}...</div>
          </div>
        `;
      })
      .join("");
  } catch {
    docList.textContent = "Failed to load documents.";
  }
}

async function loadAcknowledgments() {
  try {
    const res = await fetch(`${API_BASE}/api/acknowledgments`);
    const data = await res.json();
    if (!data.items || !data.items.length) {
      ackLog.textContent = "No acknowledgments yet.";
      return;
    }

    ackLog.innerHTML = data.items
      .map((item) => {
        const time = new Date(item.timestamp * 1000).toLocaleString();
        return `
          <div class="ack-item">
            <strong>Announcement #${item.announcementId}</strong>
            <div class="ack-meta">Student ${item.student}</div>
            <div class="ack-meta">${time}</div>
          </div>
        `;
      })
      .join("");
  } catch {
    ackLog.textContent = "Failed to load acknowledgments.";
  }
}

loadAcknowledgments();
loadDocuments();

async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `0x${hashHex}`;
}
