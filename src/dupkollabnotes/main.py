from __future__ import annotations

import os

import uvicorn


def main() -> int:
    """Startet das FastAPI-Backend fuer den API+Vite-Betrieb."""
    from .api import app

    host = os.getenv("DUPKOLLABNOTES_HOST", "127.0.0.1")
    port = int(os.getenv("DUPKOLLABNOTES_PORT", "8765"))
    uvicorn.run(app, host=host, port=port, log_level="info")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
