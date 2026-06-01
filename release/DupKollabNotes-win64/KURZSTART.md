# DupKollabNotes Kurzstart

## Start der Applikation (Windows)

## Standalone-Version fuer Kolleg:innen (ohne Adminrechte)

1. ZIP aus GitHub Release herunterladen (`DupKollabNotes-win64.zip`).
2. ZIP in einen beliebigen Ordner entpacken.
3. `DupKollabNotes.exe` starten.

Hinweis:
Die App laeuft in einem eigenen Desktop-Fenster und nicht im Browser.

## Build der Standalone-Version (fuer dich)

```powershell
npm install
python -m pip install -e .[build]
npm run desktop:release
```

Das Ergebnis liegt unter `release\DupKollabNotes-win64` und als ZIP unter `release\DupKollabNotes-win64.zip`.

### Einmalig bei neuer Umgebung

```powershell
python -m pip install -e .
npm install
```

### Backend starten (Terminal 1)

```powershell
.\.venv\Scripts\uvicorn.exe dupkollabnotes.api:app --port 8765 --reload
```

### Frontend starten (Terminal 2)

```powershell
npm run dev
```

Danach die App im Browser unter http://localhost:5173 aufrufen.

## Kurze Funktionsübersicht

- Notizen: Markdown-Notizen erstellen, bearbeiten, taggen und archivieren.
- Projekte: Projekte mit Status, Tags, Milestones und projektbezogenen Notizen verwalten.
- Aufgaben: To-dos mit Fälligkeitsdatum, Status und Zuständigkeit verfolgen.
- Milestones: Milestones filtern, als Liste anzeigen und als Outlook-Mail exportieren.
- Suche: Erweiterte Suche über Notizen und Projekte, inklusive Tag-Filter.
- Teamarbeit: Benutzer, Rollen und Sichtbarkeit (Team/Privat) für kollaborative Nutzung.
