import { useLocation } from "react-router-dom";
import { useAppStore } from "../../store/useAppStore";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/notes":     "Notizen",
  "/todos":     "Todos",
  "/search":    "Search",
  "/projects":  "Projekte",
  "/milestones": "Milestones",
  "/users":     "Team",
};

export function TopBar() {
  const { pathname } = useLocation();
  const user = useAppStore((s) => s.currentUser);
  const title = TITLES[pathname] ?? "Notes";

  return (
    <header className="flex items-center justify-between h-12 px-4 bg-bg-surface border-b border-border shrink-0">
      <h1 className="text-sm font-semibold text-text-primary">{title}</h1>
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <span className="hidden sm:inline">{user?.full_name}</span>
        <span className="px-1.5 py-0.5 rounded bg-accent-muted text-accent text-[10px] font-medium uppercase tracking-wide">
          {user?.role}
        </span>
      </div>
    </header>
  );
}
