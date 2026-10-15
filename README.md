# HelpRack - AI-Powered IT Helpdesk & Ticket Management

FastAPI + MySQL backend, NLP ticket classification, RAG over support docs, optional Claude replies, and a web UI
(ticket "rack", keycap buttons, drawer, HelpBot chat).

## Quick start
**Fastest (SQLite, no database setup)**
- Windows: double-click `run.bat`  |  Mac/Linux: `./run.sh`
- Open http://localhost:8000 (Swagger docs at `/docs`)

**With MySQL**
1. `docker compose up -d db` (or use your own MySQL and run `backend/sql/schema.sql`)
2. `cp backend/.env.example backend/.env` and keep the MySQL `DATABASE_URL`
3. Run `run.sh` / `run.bat`  - or everything in Docker: `docker compose up --build`

**Optional LLM**: put `ANTHROPIC_API_KEY=...` in `backend/.env`. Without it, replies use RAG + a template.

## Features
| Area | What it does |
|---|---|
| NLP triage | TF-IDF + Logistic Regression predicts category (Login & Access, Network, Software, Hardware, Email, Security, General) with confidence. Rules detect priority (Critical/High/Medium/Low) |
| Tickets API | create, list/filter/search, assign, auto-assign, priority, status, comments, delete |
| Assignment | best-fit agent = matching specialty with fewest open tickets |
| RAG | Markdown docs in `backend/kb/` are chunked and retrieved by TF-IDF similarity |
| LLM replies | "Draft AI reply" - Claude if key set, otherwise grounded template |
| AI agent | HelpBot answers from docs and offers to turn the chat into a ticket |
| UI | rack list, gauges, category mix bar, drawer, keycap buttons, day/night shift |

## REST API
| Method | Path | Purpose |
|---|---|---|
| POST | /api/tickets | Create (AI fills category/priority if omitted) |
| GET | /api/tickets | List (`status, priority, category, agent_id, unassigned, q, sort`) |
| GET | /api/tickets/{id} | Detail with activity |
| PATCH | /api/tickets/{id}/assign | `{agent_id}` |
| POST | /api/tickets/{id}/auto-assign | Best-fit assignment |
| POST | /api/tickets/auto-assign-all | Assign all unassigned |
| PATCH | /api/tickets/{id}/priority | `{priority}` |
| PATCH | /api/tickets/{id}/status | `{status}` |
| POST | /api/tickets/{id}/triage | Re-run NLP |
| POST | /api/tickets/{id}/suggest-reply | RAG + LLM draft |
| POST | /api/tickets/{id}/comments | Add note |
| GET/POST | /api/agents | List with load / create |
| POST | /api/classify | Preview classification |
| GET | /api/kb/search?q= | Search support docs |
| POST | /api/agent/chat | HelpBot |
| GET | /api/stats | Dashboard numbers |

## Customising
- Add training examples: `backend/app/nlp/training_data.py`
- Add support docs: drop `.md` files (with `##` sections) into `backend/kb/`
- Switch off demo data: `SEED_DEMO_DATA=false`

## Structure
```
backend/app/{main,config,database,models,schemas,seed}.py
backend/app/routers/{tickets,agents,ai}.py
backend/app/services/{rag,llm,assignment}.py
backend/app/nlp/{classifier,training_data}.py
backend/kb/*.md   backend/sql/schema.sql
frontend/{index.html,styles.css,app.js}
```
