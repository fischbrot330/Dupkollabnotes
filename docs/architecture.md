# Architektur

## Zielbild

SynkNote ist als lokale Client-Server-Anwendung gedacht, die von mehreren Teammitgliedern gegen dieselbe SQLite-Datei auf einem Netzlaufwerk verwendet werden kann. Ein FastAPI-Backend stellt die Daten bereit, das React/Vite-Frontend laeuft im Browser (Dev) oder im eingebetteten Desktop-Fenster (Release).

## Geplante Schichten

1. `config` fuer lokale App-Einstellungen wie Datenbankpfad und aktiven Benutzer.
2. `core.models` fuer das Datenmodell mit Nutzern, Vorlagen, Notizen, Projekten, Tags, Todos und Updates.
3. `core.services` als Fachschicht mit CRUD, Suche, Markdown-Rendern und Export.
4. `api` als HTTP-Schicht (FastAPI) fuer Auth, Notizen, Projekte, Milestones, Benutzer und Settings.
5. `src/` (React + Vite) als Frontend mit Seiten, Komponenten und globalem Zustand.

## Wichtige Regeln

- Nur der autorisierte Benutzer soll eigene Notizen bearbeiten koennen.
- Vorlagen werden als Markdown gespeichert und in der App wiederverwendet.
- Milestones, Todos und Updates sind projektnah und sollen sich in der Projektansicht gebuendelt darstellen.
- Tags sollen sowohl an Notizen als auch an Projekten haengen koennen.

## Naechste Ausbaustufen

- Login-Dialog mit Rollenpruefung.
- Vollstaendige Sidebar-Navigation mit gefilterten Listen.
- Outlook-Export per Mailto-Flow weiter ausbauen.
- API-Hardening (Rate-Limits, bessere Audit-Logs, konsistente 409/422-Fehlerantworten).
