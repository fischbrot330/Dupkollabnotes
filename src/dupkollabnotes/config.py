from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path


def app_data_dir() -> Path:
    base = Path.home() / ".dupkollabnotes"
    base.mkdir(parents=True, exist_ok=True)
    return base


def default_database_path() -> Path:
    return app_data_dir() / "dupkollabnotes.sqlite3"


def default_settings_path() -> Path:
    return app_data_dir() / "settings.json"


@dataclass(slots=True)
class AppSettings:
    database_path: str = str(default_database_path())
    active_user_id: int | None = None
    theme: str = "midnight"
    llm_model_path: str = ""

    @classmethod
    def load(cls, path: Path | None = None) -> "AppSettings":
        settings_path = path or default_settings_path()
        if settings_path.exists():
            payload = json.loads(settings_path.read_text(encoding="utf-8"))
            return cls(**payload)
        return cls()

    def save(self, path: Path | None = None) -> None:
        settings_path = path or default_settings_path()
        settings_path.parent.mkdir(parents=True, exist_ok=True)
        settings_path.write_text(json.dumps(asdict(self), indent=2), encoding="utf-8")

    def resolved_database_path(self) -> Path:
        return Path(self.database_path).expanduser().resolve()

    def database_url(self) -> str:
        return f"sqlite+pysqlite:///{self.resolved_database_path().as_posix()}"

    def resolved_llm_model_path(self) -> Path | None:
        raw_path = self.llm_model_path.strip()
        if not raw_path:
            return None
        return Path(raw_path).expanduser().resolve()
