import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";
import * as api from "../api";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const login    = useAppStore((s) => s.login);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      const user = await api.authenticate(username.trim(), password);
      login(user);
      navigate("/dashboard", { replace: true });
    } catch {
      setError("Ungültige Zugangsdaten. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8 gap-3">
          <img
            src="/logo.png"
            alt="SynkNote"
            className="w-10 h-10 object-contain"
            draggable={false}
          />
          <div>
            <h1 className="text-xl font-bold text-text-primary">SynkNote</h1>
            <p className="text-xs text-text-muted">Team-Notizen & Projekte</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card p-6 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Benutzername
            </label>
            <input
              className="input"
              type="text"
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Passwort
            </label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-900/30 rounded px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-md btn-primary w-full justify-center mt-1"
          >
            {loading ? "Anmelden…" : "Anmelden"}
          </button>
        </form>

        <p className="text-center text-xs text-text-muted mt-4">
          Standard: <code className="text-accent">admin</code> / <code className="text-accent">admin123</code>
        </p>
      </div>
    </div>
  );
}
