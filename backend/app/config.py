from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    workspace_base: str = "/workspaces"
    allowed_origins: str = "http://localhost:5173,http://localhost:3000,https://cloud-ide-ebon.vercel.app"
    max_processes: int = 10
    port: int = 8000
    # Extra ports the preview must never treat as a user app (comma-separated).
    # Useful when the IDE shares a host with other services. The IDE's own
    # backend port is always excluded automatically.
    reserved_ports: str = ""
    # Prefer production build-and-serve over heavy dev servers. Auto-enabled on
    # hosts with under ~1 GiB RAM; set to true to force it on.
    low_memory: bool = False

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def reserved_ports_list(self) -> list[int]:
        out = []
        for p in self.reserved_ports.split(","):
            p = p.strip()
            if p.isdigit():
                out.append(int(p))
        return out

    @property
    def workspace_path(self) -> Path:
        """Workspace root, created on first use.

        Resolves ``workspace_base`` and ensures it exists. If that location
        cannot be created (e.g. a read-only ``/workspaces`` mount), falls back
        to ``<repo>/workspaces``. The common case, where the directory already
        exists, short-circuits with a single ``stat``, so this stays cheap to
        call on every request that needs the root.
        """
        p = Path(self.workspace_base)
        if p.is_dir():
            return p
        try:
            p.mkdir(parents=True, exist_ok=True)
            return p
        except OSError:
            # Fallback to a workspaces directory inside the project root.
            fallback = Path(__file__).resolve().parents[2] / "workspaces"
            fallback.mkdir(parents=True, exist_ok=True)
            return fallback

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()
