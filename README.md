# Rich-Onebox-for-Emails
## ReachInbox Onebox Assignment

End-to-end implementation plan and scaffold for a feature-rich email onebox with IMAP real-time sync, Elasticsearch search, AI categorization, Slack/Webhook integrations, and a simple React UI plus RAG-based suggested replies.

### Stack
- Backend: Node.js + TypeScript, Express, Socket.IO
- IMAP: `imapflow` (persistent IDLE)
- Search: Elasticsearch (Docker)
- AI: OpenAI API (with rule-based fallback)
- Vector DB: LanceDB (local) for RAG
- Frontend: React + Vite + TypeScript

### Quick Start
1) Prerequisites: Docker, Node 18+
2) Copy environment files and configure secrets
```bash
cp backend/.env.example backend/.env
```
3) Start infra (Elasticsearch + Kibana):
```bash
docker compose up -d
```
4) Install deps and start backend and frontend:
```bash
cd backend && npm i && npm run dev
# in a new terminal
cd frontend && npm i && npm run dev
```

### Environment
Edit `backend/.env`:
```
PORT=4000
CLIENT_ORIGIN=http://localhost:5173

# IMAP accounts (at least 2)
IMAP1_HOST=imap.example.com
IMAP1_PORT=993
IMAP1_SECURE=true
IMAP1_USER=you@example.com
IMAP1_PASS=secret

IMAP2_HOST=imap2.example.com
IMAP2_PORT=993
IMAP2_SECURE=true
IMAP2_USER=you2@example.com
IMAP2_PASS=secret

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_INDEX=emails

# OpenAI
OPENAI_API_KEY=sk-...

# Slack webhook (Incoming Webhook URL)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# External webhook for Interested events
INTERESTED_WEBHOOK_URL=https://webhook.site/your-id
```

### Features Map
- Real-time IMAP sync using `imapflow` IDLE, last 30 days fetch per folder
- Elasticsearch indexing + search with account/folder filters
- AI categorization (OpenAI GPT + keyword fallback)
- Slack + external webhook on Interested
- REST API + WebSocket for live updates
- React UI: list, filters, search, labels, mark Interested
- RAG suggested replies using LanceDB + OpenAI

### Postman
A minimal Postman collection is provided in `docs/ReachInbox.postman_collection.json` (to be filled across iterations).


