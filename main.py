from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import Base, SessionLocal, engine
from .routers import agents, ai, tickets
from .seed import seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    if settings.SEED_DEMO_DATA:
        with SessionLocal() as db:
            seed(db)
    yield


app = FastAPI(
    title="AI IT Helpdesk & Ticket Management",
    description="NLP ticket triage, assignment, priority & status tracking, RAG over support docs.",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

app.include_router(tickets.router)
app.include_router(agents.router)
app.include_router(ai.router)


@app.get("/api/health", tags=["system"])
def health():
    return {"status": "ok"}


# Serve the web UI at "/" (must be mounted last)
app.mount("/", StaticFiles(directory=settings.FRONTEND_DIR, html=True), name="ui")
