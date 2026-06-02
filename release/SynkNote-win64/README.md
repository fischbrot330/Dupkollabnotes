# SynkNote

SynkNote ist eine lokale kollaborative Markdown-Notiz-App fuer Teamarbeit mit FastAPI-Backend, React/Vite-Frontend und SQLite-Datenbank.

## Desktop-Distribution (portable, ohne Adminrechte)

Die App kann als Windows-Desktop-Bundle bereitgestellt werden. Kolleg:innen laden eine ZIP-Datei, entpacken sie und starten `SynkNote.exe` direkt im entpackten Ordner.

- Kein Installer notwendig.
- Keine Adminrechte auf Zielrechnern notwendig.
- Frontend laeuft in einem eingebetteten Desktop-Fenster (kein externer Browser-Tab).

### Lokaler Build der EXE

1. Frontend-Abhaengigkeiten installieren: `npm install`
2. Python-Abhaengigkeiten installieren: `python -m pip install -e .[build]`
3. Portable Build erstellen: `npm run desktop:release`

Ergebnis:
- `release/SynkNote-win64` (portable Ordner)
- `release/SynkNote-win64.zip` (verteilbares ZIP)

Wichtige Dateien im Bundle:
- `SynkNote.exe` startet die Standalone-App.
- `README.md` und `KURZSTART.md` liegen im Bundle zur Weitergabe bei.

### GitHub-Ausrollung

Es gibt einen Workflow unter `.github/workflows/desktop-release.yml`.

- Bei Tag-Pushes wie `v0.2.0` baut GitHub automatisch das Windows-Desktop-Bundle.
- Das ZIP wird als Release-Asset bereitgestellt und kann direkt heruntergeladen werden.
- Optional kann der Workflow auch manuell gestartet werden (`workflow_dispatch`).

### Empfohlener Rollout ueber GitHub (ohne Adminrechte auf Ziel-PCs)

Der Workflow wird durch Tags im Format `v*` ausgeloest (z. B. `v0.2.0`).

1. Lokale Aenderungen committen und pushen.
2. Release-Tag erstellen und pushen:
	- `git tag -a v0.2.0 -m "SynkNote Release v0.2.0"`
	- `git push origin v0.2.0`
3. Workflow `Desktop Release` laeuft automatisch auf GitHub.
4. Im GitHub Release steht danach `SynkNote-win64.zip` als Download bereit.
5. Kolleg:innen laden ZIP, entpacken und starten `SynkNote.exe`.

Kurzcheck nach dem Tag-Push:
- Actions-Run ist `Success`.
- Release-Asset `SynkNote-win64.zip` ist vorhanden.

Falls der Build nicht startet:
- Pruefen, ob der Tag mit `v` beginnt.
- Pruefen, ob der Tag wirklich zu GitHub gepusht wurde.
- Optional den Workflow manuell per `workflow_dispatch` starten.

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

## Lokale AI-Notizverarbeitung (GGUF)

- In den Einstellungen kann ein lokaler GGUF-Modellpfad gesetzt werden (`llm_model_path`).
- Die Verarbeitung nutzt einen lokalen Adapter (`llama-cpp-python`, kein Cloud-API).
- Standardprompts liegen in `docs/ai-prompts/*.txt` und werden pro AI-fähigem Benutzer als persönliche Prompts angelegt.
- Nur Benutzer mit aktivierter Berechtigung **AI Funktionen** sehen AI-UI (Prompts, Modellpfad, Notiz-AI-Aktion).
- Das Flag **AI Funktionen** ist nur im Admin-User-Management sichtbar und nur von Admins änderbar.

### Setup

1. Lokales GGUF-Modell bereitstellen.
2. Optionales Backend-Paket installieren: `python -m pip install llama-cpp-python`
3. In **Settings** den GGUF-Dateipfad setzen.
4. In einer Notiz über **AI** einen Prompt wählen, Vorschau erzeugen und Ergebnis übernehmen.

### Implementierungsskizze

- Backend:
  - `AppSettings` um `llm_model_path` erweitert
  - User-Recht `can_use_ai_functions`
  - Persönliche Prompt-Tabelle `ai_prompts`
  - AI-Endpunkte: Prompt-CRUD + Notizverarbeitung
  - Lokaler GGUF-Adapter: `src/dupkollabnotes/core/llm_service.py`
- Frontend:
  - AI-gesteuerte UI-Visibility per User-Flag
  - Promptverwaltung in `SettingsPage`
  - Notizverarbeitung mit Vorschau/Übernahme in `NoteViewer`

### Copilot-ready Prompt (für weitere Iteration)

```text
Implement improvements for the local GGUF AI note-processing flow in Dupkollabnotes.
Constraints:
- Keep AI local-only (no cloud APIs).
- Respect user flag can_use_ai_functions and admin-only flag changes.
- Preserve per-user prompt isolation.
- Add UX improvements only where AI flag is enabled.
- Keep FastAPI + React architecture and make minimal, focused changes.
```
