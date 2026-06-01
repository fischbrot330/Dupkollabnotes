import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarClock,
  CheckSquare,
  FileText,
  FolderKanban,
  Milestone,
  TrendingUp,
  Users,
} from "lucide-react";
import type { DashboardData, ProjectSummary } from "../types";
import * as api from "../api";
import { Badge } from "../components/common/Badge";
import { useAppStore } from "../store/useAppStore";

function fmtDate(iso?: string | null) {
  if (!iso) return "kein Datum";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysUntil(iso?: string | null) {
  if (!iso) return Number.POSITIVE_INFINITY;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function severityClass(iso?: string | null) {
  const diff = daysUntil(iso);
  if (diff < 0) return "text-red-300 border-red-500/40 bg-red-500/10";
  if (diff <= 2) return "text-amber-300 border-amber-500/40 bg-amber-500/10";
  if (diff <= 7) return "text-sky-300 border-sky-500/40 bg-sky-500/10";
  return "text-text-secondary border-border bg-bg-active/60";
}

function projectProgress(project: ProjectSummary) {
  if (!project.todo_count) return 0;
  return Math.round((project.done_count / project.todo_count) * 100);
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: number | string;
  hint: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="card p-4 relative overflow-hidden">
      <div
        className="absolute -right-6 -top-6 w-20 h-20 rounded-full blur-2xl opacity-40"
        style={{ background: accent }}
      />
      <div className="relative flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}22`, color: accent }}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-text-muted">{label}</p>
          <p className="text-2xl font-semibold text-text-primary mt-1">{value}</p>
          <p className="text-xs text-text-muted mt-1">{hint}</p>
        </div>
      </div>
    </div>
  );
}

function TimelineItem({
  title,
  subtitle,
  date,
  accent,
  onClick,
}: {
  title: string;
  subtitle: string;
  date: string | null | undefined;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={`w-full text-left px-4 py-3 rounded-lg border transition-colors hover:bg-bg-hover ${severityClass(date)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{title}</p>
          <p className="text-xs text-text-muted mt-0.5 truncate">{subtitle}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[11px] font-semibold" style={{ color: accent }}>{fmtDate(date)}</div>
        </div>
      </div>
    </button>
  );
}

function ProgressRow({ project, onOpenProject }: { project: ProjectSummary; onOpenProject: (projectId: number) => void }) {
  const progress = projectProgress(project);

  return (
    <button
      onClick={() => onOpenProject(project.id)}
      className="w-full text-left rounded-lg border border-border/70 bg-bg-active/30 p-3 hover:border-accent/40 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{project.name}</p>
          <p className="text-xs text-text-muted mt-0.5 truncate">{project.owner_name ?? "ohne Owner"}</p>
        </div>
        <Badge variant="todo">{project.open_todos_count ?? 0} offen</Badge>
      </div>
      <div className="mt-2 h-2 rounded-full bg-bg-active overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-text-muted">
        <span>{project.done_count}/{project.todo_count} erledigt</span>
        <span>{progress}%</span>
      </div>
      <div className="mt-2 flex gap-1.5 flex-wrap">
        {(project.new_comments_count ?? 0) > 0 && <Badge variant="comment">{project.new_comments_count} Kommentare</Badge>}
        {(project.questions_count ?? 0) > 0 && <Badge variant="question">{project.questions_count} Fragen</Badge>}
        {(project.updates_count ?? 0) > 0 && <Badge variant="update">{project.updates_count} Updates</Badge>}
      </div>
    </button>
  );
}

export function DashboardPage() {
  const currentUser = useAppStore((s) => s.currentUser);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.dashboardSnapshot(currentUser?.id ?? null).then(setData).finally(() => setLoading(false));
  }, [currentUser?.id]);

  const timeline = useMemo(() => {
    if (!data) return [];
    const tasks = (data.upcoming_tasks ?? []).map((task) => ({
      kind: "task" as const,
      id: task.id,
      title: task.title,
      subtitle: `${task.project_name ?? "ohne Projekt"} · Aufgabe`,
      date: task.due_date ?? task.updated_at,
      accent: "#f59e0b",
      noteId: task.id,
    }));
    const milestones = (data.upcoming_milestones ?? []).map((milestone) => ({
      kind: "milestone" as const,
      id: milestone.id,
      title: milestone.title,
      subtitle: `${milestone.project_name ?? "ohne Projekt"} · Milestone`,
      date: milestone.milestone_date ?? milestone.due_date ?? milestone.updated_at,
      accent: "#8b5cf6",
      noteId: milestone.id,
    }));
    return [...tasks, ...milestones].sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime());
  }, [data]);

  const completedTodos = data?.completed_todos ?? 0;
  const pendingTodos = data?.pending_todos ?? 0;
  const todoCoverage = pendingTodos + completedTodos > 0 ? Math.round((completedTodos / (pendingTodos + completedTodos)) * 100) : 0;
  const openMilestones = (data?.total_milestones ?? 0) - (data?.completed_milestones ?? 0);

  if (loading) return <div className="p-8 text-text-muted text-sm">Laden…</div>;
  if (!data) return <div className="p-8 text-red-400 text-sm">Fehler beim Laden</div>;

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <section className="relative overflow-hidden card p-5">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-bg-surface to-bg-surface" />
        <div className="absolute -right-12 -top-8 w-56 h-56 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -left-10 bottom-0 w-48 h-48 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="relative grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-5 items-start">
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-text-muted">Dashboard</p>
              <h1 className="text-2xl font-semibold text-text-primary mt-2">Arbeitslage auf einen Blick</h1>
              <p className="text-sm text-text-secondary mt-2 max-w-2xl">
                Projekte, Aufgaben, Milestones und offene Notizen sind hier zusammengeführt, damit du Engpässe und nächste Schritte sofort siehst.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <MetricCard label="Notizen" value={data.total_notes} hint="Gesamter Bestand" icon={<FileText size={20} />} accent="#38bdf8" />
              <MetricCard label="Projekte" value={data.total_projects} hint={`${data.active_users} aktive Nutzer`} icon={<FolderKanban size={20} />} accent="#22c55e" />
              <MetricCard label="Offene Todos" value={pendingTodos} hint={`${completedTodos} erledigt · ${todoCoverage}% Abschlussquote`} icon={<CheckSquare size={20} />} accent="#f59e0b" />
              <MetricCard label="Offene Milestones" value={openMilestones} hint={`${data.completed_milestones ?? 0} erledigt insgesamt`} icon={<Milestone size={20} />} accent="#a855f7" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4 border border-border/70 bg-bg-active/30">
              <p className="text-[11px] uppercase tracking-wider text-text-muted">Aktivität</p>
              <p className="text-3xl font-semibold text-text-primary mt-1">{data.recent_notes.length + (data.recent_projects.length ?? 0)}</p>
              <p className="text-xs text-text-muted mt-1">Jüngste Notizen + Projekte</p>
            </div>
            <div className="card p-4 border border-border/70 bg-bg-active/30">
              <p className="text-[11px] uppercase tracking-wider text-text-muted">Erledigungsgrad</p>
              <p className="text-3xl font-semibold text-emerald-400 mt-1">{todoCoverage}%</p>
              <p className="text-xs text-text-muted mt-1">basierend auf offenen und erledigten Aufgaben</p>
            </div>
            <div className="card p-4 border border-border/70 bg-bg-active/30 col-span-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-wider text-text-muted">Todo Mix</p>
                <Badge variant="todo">{pendingTodos} offen</Badge>
              </div>
              <div className="mt-3 h-3 rounded-full bg-bg-active overflow-hidden flex">
                <div className="bg-amber-400" style={{ width: `${pendingTodos + completedTodos > 0 ? (pendingTodos / (pendingTodos + completedTodos)) * 100 : 0}%` }} />
                <div className="bg-emerald-400" style={{ width: `${todoCoverage}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-text-muted">
                <span>offen</span>
                <span>erledigt</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-text-primary inline-flex items-center gap-2"><TrendingUp size={14} /> Projekt-Hotspots</h2>
              <p className="text-xs text-text-muted mt-0.5">Projekte mit den meisten offenen Aufgaben und Kommentaren</p>
            </div>
            <button onClick={() => navigate("/projects")} className="text-xs text-accent hover:text-accent-hover inline-flex items-center gap-1">
              Alle Projekte <ArrowUpRight size={12} />
            </button>
          </div>
          <div className="p-4 space-y-3">
            {(data.projects_with_open_todos ?? []).length === 0 ? (
              <p className="text-xs text-text-muted">Keine offenen Projekt-Aufgaben.</p>
            ) : (
                (data.projects_with_open_todos ?? []).slice(0, 6).map(({ project }) => (
                <ProgressRow key={project.id} project={project} onOpenProject={(projectId) => navigate(`/projects?projectId=${projectId}`)} />
              ))
            )}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-text-primary inline-flex items-center gap-2"><CalendarClock size={14} /> Nächste Fälligkeiten</h2>
              <p className="text-xs text-text-muted mt-0.5">Aufgaben und Milestones nach Datum sortiert</p>
            </div>
            <button onClick={() => navigate("/milestones")} className="text-xs text-accent hover:text-accent-hover inline-flex items-center gap-1">
              Kalender <ArrowUpRight size={12} />
            </button>
          </div>
          <div className="p-4 space-y-2">
            {timeline.length === 0 ? (
              <p className="text-xs text-text-muted">Keine anstehenden Termine.</p>
            ) : (
              timeline.slice(0, 8).map((entry) => (
                <TimelineItem
                  key={`${entry.kind}-${entry.id}`}
                  title={entry.title}
                  subtitle={entry.subtitle}
                  date={entry.date}
                  accent={entry.accent}
                  onClick={() => navigate(`/notes?noteId=${entry.noteId}`)}
                />
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1fr_0.9fr] gap-4">
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-text-primary inline-flex items-center gap-2"><FileText size={14} /> Notizen mit offenen Todos</h2>
              <p className="text-xs text-text-muted mt-0.5">Die Einträge mit der höchsten Arbeitslast</p>
            </div>
            <button onClick={() => navigate("/notes")} className="text-xs text-accent hover:text-accent-hover inline-flex items-center gap-1">
              Zur Notizübersicht <ArrowUpRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-border/50">
            {(data.notes_with_open_todos ?? []).length === 0 && <p className="px-4 py-4 text-xs text-text-muted">Keine offenen Todos in Notizen.</p>}
            {(data.notes_with_open_todos ?? []).slice(0, 6).map(({ note, open_todos }) => (
              <button
                key={note.id}
                onClick={() => navigate(`/notes?noteId=${note.id}`)}
                className="w-full text-left px-4 py-3 hover:bg-bg-hover transition-colors flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-300 flex items-center justify-center shrink-0">
                  <FileText size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">{note.title}</p>
                  <p className="text-xs text-text-muted truncate">{note.project_name ?? "ohne Projekt"} · {note.category_name ?? "ohne Kategorie"}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant="todo">{open_todos} offen</Badge>
                  <span className="text-[10px] text-text-muted">{fmtDateTime(note.updated_at)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-text-primary inline-flex items-center gap-2"><FolderKanban size={14} /> Letzte Projekte</h2>
              <p className="text-xs text-text-muted mt-0.5">Schneller Zugriff auf die zuletzt bearbeiteten Projekte</p>
            </div>
            <button onClick={() => navigate("/projects")} className="text-xs text-accent hover:text-accent-hover inline-flex items-center gap-1">
              Projektliste <ArrowUpRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-border/50">
            {(data.recent_projects ?? []).length === 0 && <p className="px-4 py-4 text-xs text-text-muted">Keine Projekte vorhanden.</p>}
            {(data.recent_projects ?? []).slice(0, 5).map((project) => (
              <button
                key={project.id}
                onClick={() => navigate(`/projects?projectId=${project.id}`)}
                className="w-full text-left px-4 py-3 hover:bg-bg-hover transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-text-primary truncate">{project.name}</p>
                    <p className="text-xs text-text-muted truncate">{project.owner_name ?? "kein Owner"} · {fmtDateTime(project.updated_at)}</p>
                  </div>
                  <Badge>{project.status}</Badge>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-text-muted">
                  <span>{project.open_todos_count ?? 0} offene Aufgaben</span>
                  <span>{project.open_milestones_count ?? 0} Milestones offen</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary inline-flex items-center gap-2"><Users size={14} /> Zuletzt bearbeitet</h2>
            <button onClick={() => navigate("/notes")} className="text-xs text-accent hover:text-accent-hover inline-flex items-center gap-1">
              Alle Notizen <ArrowUpRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-border/50">
            {(data.recent_notes ?? []).length === 0 && <p className="px-4 py-4 text-xs text-text-muted">Noch keine Notizen vorhanden.</p>}
            {(data.recent_notes ?? []).slice(0, 6).map((note) => (
              <button key={note.id} onClick={() => navigate(`/notes?noteId=${note.id}`)} className="w-full text-left px-4 py-3 hover:bg-bg-hover flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-text-primary truncate">{note.title}</p>
                  <p className="text-xs text-text-muted truncate">{note.project_name ?? "ohne Projekt"} · {note.author_name ?? "unbekannt"}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {note.is_milestone && <Badge variant="update">Milestone</Badge>}
                  {(note.open_todos_count ?? 0) > 0 && <Badge variant="todo">{note.open_todos_count}</Badge>}
                  <span className="text-[10px] text-text-muted">{fmtDateTime(note.updated_at)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary inline-flex items-center gap-2"><Milestone size={14} /> Milestone-Status</h2>
            <button onClick={() => navigate("/milestones")} className="text-xs text-accent hover:text-accent-hover inline-flex items-center gap-1">
              Milestones <ArrowUpRight size={12} />
            </button>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-border/70 bg-bg-active/30 p-3">
              <p className="text-xs text-text-muted uppercase tracking-wider">Offen</p>
              <p className="text-2xl font-semibold text-text-primary mt-1">{openMilestones}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-bg-active/30 p-3">
              <p className="text-xs text-text-muted uppercase tracking-wider">Erledigt</p>
              <p className="text-2xl font-semibold text-emerald-400 mt-1">{data.completed_milestones ?? 0}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-bg-active/30 p-3">
              <p className="text-xs text-text-muted uppercase tracking-wider">Aktive Nutzer</p>
              <p className="text-2xl font-semibold text-sky-300 mt-1">{data.active_users}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
