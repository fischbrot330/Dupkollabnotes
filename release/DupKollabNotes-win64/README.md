# DupKollabNotes

Lokale kollaborative Markdown-Notiz-App fuer Teamarbeit mit FastAPI-Backend, React/Vite-Frontend und SQLite-Datenbank.

## Desktop-Distribution (portable, ohne Adminrechte)

Die App kann als Windows-Desktop-Bundle bereitgestellt werden. Kolleg:innen laden eine ZIP-Datei, entpacken sie und starten `DupKollabNotes.exe` direkt im entpackten Ordner.

- Kein Installer notwendig.
- Keine Adminrechte auf Zielrechnern notwendig.
- Frontend laeuft in einem eingebetteten Desktop-Fenster (kein externer Browser-Tab).

### Lokaler Build der EXE

1. Frontend-Abhaengigkeiten installieren: `npm install`
2. Python-Abhaengigkeiten installieren: `python -m pip install -e .[build]`
3. Portable Build erstellen: `npm run desktop:release`

Ergebnis: `release/DupKollabNotes-win64` (Ordner) und `release/DupKollabNotes-win64.zip`.

### GitHub-Ausrollung

Es gibt einen Workflow unter `.github/workflows/desktop-release.yml`.

- Bei Tag-Pushes wie `v0.2.0` baut GitHub automatisch das Windows-Desktop-Bundle.
- Das ZIP wird als Release-Asset bereitgestellt und kann direkt heruntergeladen werden.
- Optional kann der Workflow auch manuell gestartet werden (`workflow_dispatch`).

## Ziele

- Gemeinsame Arbeit auf einer zentralen SQLite-Datei auf dem Netzlaufwerk.
- Lokales API-Backend mit Web-Frontend fuer Teamarbeit im LAN.
- Markdown-Editor mit Live-Vorschau im GitHub-Stil.
- Vorlagen, Kategorien, Projekte, To-dos, Updates, Tags und Milestones.
- Benutzerverwaltung mit Rollen und Bearbeitungsrechten.

## Erste Ausfuehrung

1. Virtuelle Umgebung anlegen und aktivieren.
2. Python-Abhaengigkeiten installieren: `python -m pip install -e .`
3. Frontend-Abhaengigkeiten installieren: `npm install`
4. Backend starten: `.\.venv\Scripts\uvicorn.exe dupkollabnotes.api:app --port 8765 --reload`
5. Frontend starten: `npm run dev`

## Hinweise zum aktuellen Stand

Das Projekt ist auf den Runtime-Modus API + Vite bereinigt. Nicht genutzte Build- und Alt-Stacks wurden in den Archiv-Ordner verschoben.
