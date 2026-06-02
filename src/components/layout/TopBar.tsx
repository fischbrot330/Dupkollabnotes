import { useLocation } from "react-router-dom";
import { useAppStore } from "../../store/useAppStore";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/notes":     "Notizen",
  "/todos":     "Todos",
  "/search":    "Suche",
  "/projects":  "Projekte",
  "/milestones": "Milestones",
  "/users":     "Teamverwaltung",
  "/meta":      "Meta",
  "/settings":  "Einstellungen",
};

export function TopBar() {
  const { pathname } = useLocation();
  const user = useAppStore((s) => s.currentUser);
  const title = TITLES[pathname] ?? "SynkNote";

  return (
    <header className="flex items-center justify-between h-[72px] px-5 bg-bg-surface border-b border-border shrink-0">
      <h1 className="text-base font-semibold text-text-primary">{title}</h1>
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <span className="hidden sm:inline">{user?.full_name}</span>
        <span className="px-1.5 py-0.5 rounded bg-accent-muted text-accent text-[10px] font-medium uppercase tracking-wide">
          {user?.role}
        </span>
      </div>
    </header>
  );
}
