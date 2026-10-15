import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def _bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL") or f"sqlite:///{BASE_DIR / 'helpdesk.db'}"
    AUTO_ASSIGN: bool = _bool("AUTO_ASSIGN", True)
    SEED_DEMO_DATA: bool = _bool("SEED_DEMO_DATA", True)
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "claude-sonnet-5-5")
    KB_DIR: Path = BASE_DIR / "kb"
    FRONTEND_DIR: Path = BASE_DIR.parent / "frontend"


settings = Settings()
