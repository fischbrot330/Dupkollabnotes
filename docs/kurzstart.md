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

Der Workflow `.github/workflows/desktop-release.yml` startet automatisch bei Tags, die mit `v` beginnen (`v*`).

Beispiel:
- `v0.2.0` startet den Release-Build.
- `0.2.0` startet den Release-Build nicht.

### Schritt-fuer-Schritt: Tag + Desktop Release

1. Aenderungen committen und den Branch pushen.
2. Version waehlen (empfohlen SemVer):
	- Patch: `v0.2.1` (Bugfix)
	- Minor: `v0.3.0` (neue Features)
	- Major: `v1.0.0` (Breaking Changes)
3. Tag lokal erstellen und zu GitHub pushen:

```powershell
git tag -a v0.2.0 -m "SynkNote Release v0.2.0"
git push origin v0.2.0
```

4. In GitHub unter Actions pruefen, dass `Desktop Release` durchgelaufen ist.
5. Im zugehoerigen GitHub Release liegt danach `SynkNote-win64.zip` als Download.
6. ZIP an Kolleg:innen verteilen (Download-Link oder direktes Weiterreichen).

### Woran erkennst du, dass alles geklappt hat?

- Actions-Run ist gruen (Status `Success`).
- Im Release gibt es das Asset `SynkNote-win64.zip`.
- Nach Entpacken startet `SynkNote.exe` ohne Installation.

### Typische Fehlerquellen

- Tag ohne `v` Prefix (z. B. `0.2.0`) -> Workflow wird nicht automatisch gestartet.
- Tag wurde lokal erstellt, aber nicht gepusht -> kein GitHub Build.
- Falscher Commit getaggt -> neuen Tag setzen oder alten Tag auf den richtigen Commit verschieben.

### Tag korrigieren (falls noetig)

```powershell
# Lokalen Tag loeschen
git tag -d v0.2.0

# Remote Tag loeschen
git push origin :refs/tags/v0.2.0

# Tag auf korrektem Commit neu erstellen und pushen
git tag -a v0.2.0 -m "SynkNote Release v0.2.0"
git push origin v0.2.0
```

### Manueller Start ohne neuen Tag

Alternativ kannst du in GitHub unter Actions den Workflow `Desktop Release` per `Run workflow` manuell starten.

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
