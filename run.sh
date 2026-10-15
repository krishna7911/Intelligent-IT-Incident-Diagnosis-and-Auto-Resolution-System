#!/usr/bin/env bash
# One-command start (Linux/macOS). Uses SQLite unless backend/.env sets DATABASE_URL to MySQL.
set -e
cd "$(dirname "$0")/backend"
[ -d .venv ] || python3 -m venv .venv
source .venv/bin/activate
pip install -q -r requirements.txt
echo "Open http://localhost:8000  (API docs: http://localhost:8000/docs)"
uvicorn app.main:app --reload --port 8000
