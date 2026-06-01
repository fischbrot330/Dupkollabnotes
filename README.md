# DupKollabNotes

Lokale kollaborative Markdown-Notiz-App fuer Teamarbeit mit FastAPI-Backend, React/Vite-Frontend und SQLite-Datenbank.

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
