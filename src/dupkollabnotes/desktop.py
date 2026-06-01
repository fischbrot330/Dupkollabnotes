from __future__ import annotations

import os
import socket
import sys
import threading
import time
import urllib.request
from pathlib import Path

import uvicorn
import webview


def _load_api_app():
    """Import API app for both package mode and PyInstaller script mode."""
    try:
        from .api import app  # type: ignore

        return app
    except ImportError:
        # Fallback for bundled/script execution without package context.
        base_dir = Path(__file__).resolve().parent.parent
        if str(base_dir) not in sys.path:
            sys.path.insert(0, str(base_dir))

        from dupkollabnotes.api import app  # type: ignore

        return app


def _find_dist_dir() -> Path | None:
    """Resolve frontend dist directory for source and bundled executions."""
    env_dir = os.getenv("DUPKOLLABNOTES_DIST_DIR")
    if env_dir:
        candidate = Path(env_dir).expanduser().resolve()
        if candidate.exists():
            return candidate

    here = Path(__file__).resolve()
    candidates = [
        here.parent.parent.parent / "dist",
        Path.cwd() / "dist",
    ]

    for candidate in candidates:
        if candidate.exists():
            return candidate

    # PyInstaller onefile/onedir support.
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        base = Path(meipass)
        for candidate in (base / "dist", base.parent / "dist"):
            if candidate.exists():
                return candidate

    return None


def _pick_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _wait_for_server(url: str, timeout_seconds: float = 20.0) -> bool:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1.5) as response:
                if response.status < 500:
                    return True
        except Exception:
            time.sleep(0.2)
    return False


def main() -> int:
    dist_dir = _find_dist_dir()
    if not dist_dir:
        raise RuntimeError(
            "Frontend-Build nicht gefunden. Bitte zuerst 'npm run build' ausfuehren."
        )

    os.environ["DUPKOLLABNOTES_DIST_DIR"] = str(dist_dir)

    app = _load_api_app()

    port = _pick_free_port()
    host = "127.0.0.1"
    url = f"http://{host}:{port}"

    config = uvicorn.Config(app=app, host=host, port=port, log_level="warning")
    server = uvicorn.Server(config)

    thread = threading.Thread(target=server.run, name="dupkollabnotes-api", daemon=True)
    thread.start()

    if not _wait_for_server(url):
        server.should_exit = True
        raise RuntimeError("Backend konnte nicht gestartet werden.")

    window = webview.create_window(
        title="SynkNote",
        url=url,
        width=1400,
        height=900,
        min_size=(1000, 700),
    )
    webview.start(private_mode=False)

    server.should_exit = True
    thread.join(timeout=3)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())