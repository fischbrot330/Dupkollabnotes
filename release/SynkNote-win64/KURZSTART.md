# SynkNote Kurzstart

## Standalone-Version fuer Kolleg:innen (ohne Adminrechte)

1. ZIP aus GitHub Release herunterladen (`SynkNote-win64.zip`).
2. ZIP in einen beliebigen Ordner entpacken.
3. `SynkNote.exe` starten.

Hinweis:
Die App laeuft in einem eigenen Desktop-Fenster (kein Browser-Tab).

## Kompilieren der Standalone-Version (lokal)

### Voraussetzungen

- Windows 10/11
- Python 3.12+
- Node.js 20+

```powershell
npm install
python -m pip install -e .[build]
npm run desktop:release
```

Ergebnis:

- `release\SynkNote-win64` (portable Ordner)
- `release\SynkNote-win64.zip` (weitergebbares ZIP)

## Ausrollen ueber GitHub Releases

1. Aenderungen committen und pushen.
2. Tag erstellen und pushen (Beispiel):

```powershell
git tag v0.2.0
git push origin v0.2.0
```

3. GitHub-Workflow `Desktop Release` baut automatisch das Release-ZIP.
4. Im GitHub Release `SynkNote-win64.zip` herunterladen und verteilen.

## Browser-Dev-Modus (nur Entwicklung)

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
