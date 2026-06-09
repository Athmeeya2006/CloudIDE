from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    workspace_base: str = "/workspaces"
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"
    max_processes: int = 10
    port: int = 8000

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    @property
    def workspace_path(self) -> Path:
        p = Path(self.workspace_base)
        p.mkdir(parents=True, exist_ok=True)
        return p

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()
