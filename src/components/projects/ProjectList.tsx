import { Archive, Search, Plus } from "lucide-react";
import type { ProjectSummary } from "../../types";
import { Badge } from "../common/Badge";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
}

const STATUS_COLOR: Record<string, string> = {
  active: "text-emerald-400",
  completed: "text-blue-400",
  archived: "text-text-muted",
};

interface Props {
  projects: ProjectSummary[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onNew: () => void;
  search: string;
  onSearch: (s: string) => void;
  includeArchived?: boolean;
  onToggleArchived?: () => void;
}

export function ProjectList({ projects, selectedId, onSelect, onNew, search, onSearch, includeArchived, onToggleArchived }: Props) {
  return (
    <aside className="flex flex-col w-72 h-full bg-bg-surface border-r border-border shrink-0">
      <div className="px-3 pt-3 pb-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex-1">
            Projekte
          </span>
          <button onClick={onNew} className="btn-sm btn-primary">
            <Plus size={13} /> Neu
          </button>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            className="input-sm pl-7"
            placeholder="Projekte suchen…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer">
          <input
            type="checkbox"
            className="w-3.5 h-3.5 accent-accent"
            checked={includeArchived ?? false}
            onChange={onToggleArchived}
          />
          <Archive size={11} className="text-text-muted" />
          <span className="text-[10px] text-text-muted">Archivierte anzeigen</span>
        </label>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {projects.length === 0 ? (
          <p className="px-4 py-8 text-xs text-text-muted text-center">Keine Projekte</p>
        ) : (
          projects.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={`w-full text-left px-3 py-3 border-b border-border/50 transition-colors
                          hover:bg-bg-hover group
                          ${selectedId === p.id ? "bg-bg-active border-l-2 border-l-accent" : ""}
                          ${p.is_user_archived ? "opacity-60" : ""}`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {p.is_user_archived && <Archive size={10} className="text-amber-400 shrink-0" />}
                    <p className={`text-sm font-medium truncate ${selectedId === p.id ? "text-text-primary" : "text-text-secondary group-hover:text-text-primary"}`}>
                      {p.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[10px] font-medium ${STATUS_COLOR[p.status] ?? "text-text-muted"}`}>
                      {p.status}
                    </span>
                    {p.owner_name && <span className="text-[10px] text-text-muted">• {p.owner_name}</span>}
                  </div>
                  {/* Progress */}
                  {p.todo_count > 0 && (
                    <div className="mt-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1 bg-bg-active rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${(p.done_count / p.todo_count) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-text-muted">{p.done_count}/{p.todo_count}</span>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {(p.open_todos_count ?? 0) > 0 && <Badge variant="todo">{p.open_todos_count} offen</Badge>}
                    {(p.new_comments_count ?? 0) > 0 && <Badge variant="comment">{p.new_comments_count}</Badge>}
                    {(p.questions_count ?? 0) > 0 && <Badge variant="question">{p.questions_count}</Badge>}
                    {(p.updates_count ?? 0) > 0 && <Badge variant="update">{p.updates_count}</Badge>}
                    {(p.open_milestones_count ?? 0) > 0 && <Badge variant="update">{p.open_milestones_count} milestones</Badge>}
                    {(p.completed_milestones_count ?? 0) > 0 && <Badge>{p.completed_milestones_count} done</Badge>}
                  </div>
                </div>
                {p.milestone_date && (
                  <span className="text-[10px] text-text-muted shrink-0">{fmtDate(p.milestone_date)}</span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
