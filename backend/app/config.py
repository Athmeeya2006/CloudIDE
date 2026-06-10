from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    workspace_base: str = "/workspaces"
    allowed_origins: str = "http://localhost:5173,http://localhost:3000,https://cloud-ide-ebon.vercel.app"
    max_processes: int = 10
    port: int = 8000

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    @property
    def workspace_path(self) -> Path:
        p = Path(self.workspace_base)
        try:
            p.mkdir(parents=True, exist_ok=True)
            return p
        except PermissionError:
            # Fallback to workspaces directory inside the project root
            fallback = Path(__file__).resolve().parents[2] / "workspaces"
            fallback.mkdir(parents=True, exist_ok=True)
            return fallback

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()
