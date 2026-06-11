# Decentralised Academic Assistant

This repository contains the course project: an on‑chain announcement system
with a retrieval‑augmented chat interface. The project is split into three
main parts: smart contracts, a Node.js backend, and a simple frontend.

The goal is to keep announcements and document hashes on‑chain, let students
acknowledge notices with wallet‑signed transactions, and provide a permission‑
aware chat that answers only from verifiable on‑chain content.

What’s in this repo
- chain/: Solidity contracts, Hardhat config, and TypeScript tests (viem).
- backend/: Express API that talks to the chain and the local LLM (optional).
- frontend/: Minimal student and professor UIs (HTML, CSS, JS).
- scripts/: small helper scripts (demo, deploy shortcuts).
- docs/: demo assets and usage notes.

Prerequisites
- Node.js (v18+ recommended)
- npm
- Git
- A local Ethereum node for development (Hardhat is included)
- Optional: Ollama (or any LLM) if you want to run the AI agent locally

Quick start (development)
1. Install dependencies (root contains per‑package subfolders):

```bash
cd chain && npm install
cd ../backend && npm install
```

2. Start a local Hardhat node (in a terminal):

```bash
cd chain
npx hardhat node
```

3. Deploy the contracts and seed roles (new terminal):

```bash
cd chain
npm run deploy:local
npm run seed:local
```

4. Configure the backend environment
- Copy `backend/.env.example` to `backend/.env` and set values as needed (RPC URL,
	contract addresses, private keys). The default RPC_URL is `http://127.0.0.1:8545`.

5. Start the backend (in its folder):

```bash
cd backend
npm run dev
```

6. Serve the frontend (simple static server):

```bash
cd frontend
# any static server works; python is the simplest for demo
python3 -m http.server 5173

# Open http://127.0.0.1:5173 in your browser
```

AI (optional)
- The project can call a local Ollama server or any LLM API. If you want to run
	the local model, install Ollama and pull a model (e.g. `llama3.1:8b`) and
	point `OLLAMA_URL` in `backend/.env` to the service (default: `http://127.0.0.1:11434`).

Smoke/demo helpers
- `scripts/demo-chat.sh` posts a sample question to the running backend and
	saves the JSON response under `docs/demo/` (backend must be running).

Notes on security and submission
- Do NOT commit secret keys or `.env` files. Use `backend/.env.example` as a
	template for instructors.
- The repo is prepared for submission: contracts, tests, backend, and frontend
	are present. Add a short recorded walkthrough or the demo script output to
	complement the code when submitting.

Need help?
- Tell me which part you want packaged (demo output, video guide, or a
	one‑page checklist) and I’ll prepare it and push it to the repo.

