import { useEffect, useState } from "react";
import * as api from "../api";

export function SettingsPage() {
  const [databasePath, setDatabasePath] = useState("");
  const [theme, setTheme] = useState("midnight");
  const [resolvedPath, setResolvedPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api.getSettings().then((s) => {
      setDatabasePath(s.database_path);
      setTheme(s.theme);
      setResolvedPath(s.resolved_database_path);
    });
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const result = await api.updateSettings({ database_path: databasePath, theme });
      setMessage(result.requires_restart ? "Gespeichert. Neustart der App erforderlich." : "Gespeichert.");
      const s = await api.getSettings();
      setResolvedPath(s.resolved_database_path);
    } catch (e) {
      setMessage(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto card p-5 space-y-4">
        <h2 className="text-base font-semibold text-text-primary">Einstellungen</h2>
        {message && <p className="text-xs text-text-secondary">{message}</p>}
        <div>
          <label className="text-xs text-text-muted block mb-1">Datenbank-Pfad</label>
          <input className="input" value={databasePath} onChange={(e) => setDatabasePath(e.target.value)} />
          <p className="text-[11px] text-text-muted mt-1">Aktuell aufgelöst: {resolvedPath}</p>
        </div>
        <div>
          <label className="text-xs text-text-muted block mb-1">Theme</label>
          <select className="input" value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value="midnight">midnight</option>
            <option value="light">light</option>
          </select>
        </div>
        <div className="flex justify-end">
          <button onClick={save} disabled={saving} className="btn-sm btn-primary">{saving ? "Speichern…" : "Speichern"}</button>
        </div>
      </div>
    </div>
  );
}
