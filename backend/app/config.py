from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # AI provider selection: "openrouter" (default) or "gemini"
    ai_provider: str = "openrouter"

    # OpenRouter (OpenAI-compatible) — used when ai_provider == "openrouter"
    openrouter_api_key: str | None = None
    openrouter_model: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_daily_limit: int = 50
    openrouter_site_url: str = "https://studymate.local"
    openrouter_app_name: str = "StudyMate AI"

    # Gemini (legacy fallback) — used when ai_provider == "gemini"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.6-flash"

    cors_origins: str = "*"

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parent.parent / ".env",
        env_file_encoding="utf-8",
    )

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def has_ai_provider(self) -> bool:
        if self.ai_provider == "openrouter":
            return bool(self.openrouter_api_key)
        return bool(self.gemini_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
