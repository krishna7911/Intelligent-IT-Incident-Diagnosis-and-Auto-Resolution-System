@echo off
cd /d %~dp0backend
if not exist .venv python -m venv .venv
call .venv\Scripts\activate
pip install -q -r requirements.txt
echo Open http://localhost:8000  (API docs: http://localhost:8000/docs)
uvicorn app.main:app --reload --port 8000
