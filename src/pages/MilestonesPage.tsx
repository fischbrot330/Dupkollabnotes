import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Mail, Milestone } from "lucide-react";
import MDEditor from "@uiw/react-md-editor";
import type { NoteSummary, User } from "../types";
import * as api from "../api";
import { Badge } from "../components/common/Badge";
import { useAppStore } from "../store/useAppStore";

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "kein Datum";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function milestoneMailBody(items: NoteSummary[], heading: string) {
  const blocks = items.map((item) => {
    const owner = item.author_name ?? "Unbekannt";
    const project = item.project_name ?? "Ohne Projekt";
    const body = (item.content ?? "(Kein Inhalt hinterlegt)").trim() || "(Kein Inhalt hinterlegt)";
    const due = fmtDate(item.due_date);
    const milestone = fmtDate(item.milestone_date);

    return [
      `<p style="font-size:15pt;font-weight:700;margin:0 0 2px 0;">${item.title} (${owner}):</p>`,
      `<p style="font-size:10pt;font-style:italic;margin:0 0 8px 0;">${project}</p>`,
      `<p style="font-size:11pt;margin:0 0 8px 0;white-space:pre-wrap;">${body.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`,
      `<p style="font-size:10pt;font-style:italic;font-weight:700;margin:0 0 16px 0;">Due Date: ${due} | Milestone Date: ${milestone}</p>`,
    ].join("\n");
  });

  return [
    `<p style="font-size:16pt;font-weight:700;margin:0 0 6px 0;">Management Milestone Summary</p>`,
    `<p style="font-size:10pt;color:#666;margin:0 0 14px 0;">${heading} | Erstellt am ${new Date().toLocaleString("de-DE")}</p>`,
    ...blocks,
  ].join("\n");
}

export function MilestonesPage() {
  const currentUser = useAppStore((s) => s.currentUser);
  const navigate = useNavigate();

  const [items, setItems] = useState<NoteSummary[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "open" | "completed">("all");
  const [hasDate, setHasDate] = useState<"all" | "yes" | "no">("all");
  const [period, setPeriod] = useState<"all" | "weekly" | "monthly" | "quarterly" | "custom">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [authorId, setAuthorId] = useState<number | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);

  const [loading, setLoading] = useState(false);

  async function openMilestonesMail(mailItems: NoteSummary[], heading: string) {
    if (mailItems.length === 0) {
      window.alert("Keine Milestones in der aktuellen Auswahl.");
      return;
    }

    try {
      const subject = `Milestone Report – ${new Date().toLocaleDateString("de-DE")}`;
      const body = milestoneMailBody(mailItems, heading);
      await api.openOutlookDraft(subject, body);
    } catch (e) {
      window.alert(`Outlook-Mail konnte nicht geöffnet werden: ${String(e)}`);
    }
  }

  async function loadMilestones() {
    setLoading(true);
    try {
      const list = await api.listAllMilestones({
        search: search || null,
        status,
        has_date: hasDate,
        period,
        start_date: period === "custom" ? startDate || null : null,
        end_date: period === "custom" ? endDate || null : null,
        author_id: authorId,
        project_id: projectId,
        viewer_id: currentUser?.id ?? null,
        include_archived: includeArchived,
      });
      setItems(list);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([
      api.listUsers(),
      api.listProjects({ search: null, status: null, owner_id: null }),
    ]).then(([usrs, projs]) => {
      setUsers(usrs);
      setProjects(projs.map((p) => ({ id: p.id, name: p.name })));
    });
  }, []);

  useEffect(() => {
    loadMilestones();
  }, [status, hasDate, period, authorId, projectId, includeArchived, currentUser?.id]);

  const exportHeading = useMemo(() => {
    const owner = authorId ? (users.find((u) => u.id === authorId)?.full_name ?? "Unbekannt") : "Alle Personen";
    const project = projectId ? (projects.find((p) => p.id === projectId)?.name ?? "Unbekannt") : "Alle Projekte";
    return `Filter: Zeitraum=${period}, Status=${status}, Person=${owner}, Projekt=${project}`;
  }, [authorId, projectId, period, status, users, projects]);

  return (
    <div className="h-full overflow-y-auto p-6 space-y-4">
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-text-primary">Milestones</h3>
          <div className="flex items-center gap-2">
            <button className="btn-sm btn-ghost" onClick={() => openMilestonesMail(items, exportHeading)}>
              <Mail size={12} /> Gefilterte Liste als Mail
            </button>
            <button className="btn-sm btn-primary" onClick={loadMilestones}>Aktualisieren</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
          <div>
            <label className="text-xs text-text-muted mb-1 block">Suche</label>
            <input className="input-sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Titel/Inhalt" />
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">Status</label>
            <select title="Milestone-Status" className="input-sm" value={status} onChange={(e) => setStatus(e.target.value as "all" | "open" | "completed")}>
              <option value="all">Alle</option>
              <option value="open">Offen</option>
              <option value="completed">Abgeschlossen</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">Mit Datum</label>
            <select title="Milestone hat Datum" className="input-sm" value={hasDate} onChange={(e) => setHasDate(e.target.value as "all" | "yes" | "no")}>
              <option value="all">Alle</option>
              <option value="yes">Ja</option>
              <option value="no">Nein</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">Zeitraum</label>
            <select title="Zeitraum" className="input-sm" value={period} onChange={(e) => setPeriod(e.target.value as "all" | "weekly" | "monthly" | "quarterly" | "custom")}>
              <option value="all">Alle</option>
              <option value="weekly">Wöchentlich</option>
              <option value="monthly">Monatlich</option>
              <option value="quarterly">Quartal</option>
              <option value="custom">Eigener Zeitraum</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
          <div>
            <label className="text-xs text-text-muted mb-1 block">Person</label>
            <select title="Bearbeiter" className="input-sm" value={authorId ?? ""} onChange={(e) => setAuthorId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Alle Personen</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">Projekt</label>
            <select title="Projekt" className="input-sm" value={projectId ?? ""} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Alle Projekte</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {period === "custom" && (
            <>
              <div>
                <label className="text-xs text-text-muted mb-1 block">Von</label>
                <input title="Startdatum" className="input-sm" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">Bis</label>
                <input title="Enddatum" className="input-sm" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button className="btn-sm btn-primary" onClick={loadMilestones}>Anwenden</button>
          <label className="inline-flex items-center gap-2 text-xs text-text-muted px-2">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
            Archivierte anzeigen
          </label>
          <button
            className="btn-sm btn-ghost"
            onClick={() => {
              setSearch("");
              setStatus("all");
              setHasDate("all");
              setPeriod("all");
              setStartDate("");
              setEndDate("");
              setAuthorId(null);
              setProjectId(null);
              setIncludeArchived(false);
            }}
          >
            Filter zurücksetzen
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-text-muted">Laden...</p>}

      {!loading && items.length === 0 && (
        <div className="card p-6 text-sm text-text-muted">Keine Milestones mit den gesetzten Filtern.</div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => {
            const isCompleted = Boolean(item.completed_at || item.is_archived);
            return (
            <article key={item.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <button className="text-left min-w-0 flex-1" onClick={() => navigate(`/notes?noteId=${item.id}`)}>
                  <p className="text-sm font-semibold text-text-primary truncate">{item.title}</p>
                  <p className="text-xs text-text-muted mt-1">{item.author_name ?? "Unbekannt"}</p>
                </button>
                <Badge variant={isCompleted ? "default" : "update"}>{isCompleted ? "abgeschlossen" : "offen"}</Badge>
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap text-xs text-text-muted">
                <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {fmtDate(item.milestone_date)}</span>
                {item.due_date && <span>Due: {fmtDate(item.due_date)}</span>}
                {item.category_name && <Badge>{item.category_name}</Badge>}
              </div>
              <div className="mt-3" data-color-mode="dark">
                <MDEditor.Markdown source={item.content || "*Kein Inhalt*"} style={{ background: "transparent" }} />
              </div>
              {item.project_id && item.project_name && (
                <button className="mt-2 text-xs text-accent hover:text-accent-hover inline-flex items-center gap-1" onClick={() => navigate(`/projects?projectId=${item.project_id}`)}>
                  <Milestone size={12} /> {item.project_name}
                </button>
              )}
            </article>
          );})}
        </div>
      )}
    </div>
  );
}
