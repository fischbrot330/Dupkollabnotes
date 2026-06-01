from __future__ import annotations

from pathlib import Path

from PIL import Image


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    source = root / "logo.png"
    target_dir = root / "build-assets"
    target = target_dir / "synknote.ico"

    if not source.exists():
        raise FileNotFoundError(f"Logo nicht gefunden: {source}")

    target_dir.mkdir(parents=True, exist_ok=True)

    with Image.open(source) as img:
        # Transparentes PNG in ein Windows-ICO mit mehreren Groessen umwandeln.
        img.save(target, format="ICO", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

    print(f"Icon erstellt: {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
