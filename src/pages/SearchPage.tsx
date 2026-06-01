import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AdvancedSearchFilter, AdvancedSearchResult, Category, Tag, User } from "../types";
import * as api from "../api";
import { useAppStore } from "../store/useAppStore";
import { Badge } from "../components/common/Badge";

function fmtDate(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightedText({ text, query, exact }: { text: string; query: string; exact: boolean }) {
  const parts = useMemo(() => {
    const safe = (text || "").trim();
    const normalized = query.trim();
    if (!safe || !normalized) return [safe];

    if (exact) {
      const re = new RegExp(`(${escapeRegExp(normalized)})`, "ig");
      return safe.split(re);
    }

    const terms = normalized.split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [safe];
    const re = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "ig");
    return safe.split(re);
  }, [text, query, exact]);

  const normalized = query.trim().toLowerCase();
  const terms = normalized.split(/\s+/).filter(Boolean);

  return (
    <>
      {parts.map((part, idx) => {
        const check = part.toLowerCase();
        const isHit = exact ? check === normalized : terms.includes(check);
        return isHit ? <mark key={`${part}-${idx}`} className="bg-amber-300/30 text-amber-200 px-0.5 rounded">{part}</mark> : <span key={`${part}-${idx}`}>{part}</span>;
      })}
    </>
  );
}

export function SearchPage() {
  const navigate = useNavigate();
  const currentUser = useAppStore((s) => s.currentUser);

  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);

  const [query, setQuery] = useState("");
  const [exactMatch, setExactMatch] = useState(false);
  const [period, setPeriod] = useState<"weekly" | "monthly" | "quarterly" | "custom" | "all">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [tagQuery, setTagQuery] = useState("");
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [authorId, setAuthorId] = useState<number | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdvancedSearchResult>({ notes: [], projects: [] });

  useEffect(() => {
    Promise.all([
      api.listCategories(),
      api.listTags(),
      api.listUsers(),
      api.listProjects({ search: null, status: null, owner_id: null }),
    ]).then(([cats, tgs, usrs, projs]) => {
      setCategories(cats);
      setTags(tgs);
      setUsers(usrs);
      setProjects(projs.map((p) => ({ id: p.id, name: p.name })));
    });
  }, []);

  const tagSuggestions = tags
    .filter((t) => t.name.toLowerCase().includes(tagQuery.trim().toLowerCase()) && !tagIds.includes(t.id))
    .slice(0, 10);

  function addTagId(id: number) {
    setTagIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setTagQuery("");
  }

  function removeTagId(id: number) {
    setTagIds((prev) => prev.filter((x) => x !== id));
  }

  async function runSearch() {
    setLoading(true);
    setError(null);
    try {
      const payload: AdvancedSearchFilter = {
        query,
        exact_match: exactMatch,
        category_ids: categoryId != null ? [categoryId] : [],
        tag_ids: tagIds,
        author_ids: authorId != null ? [authorId] : [],
        project_ids: projectId != null ? [projectId] : [],
        period,
        start_date: period === "custom" ? (startDate || null) : null,
        end_date: period === "custom" ? (endDate || null) : null,
        viewer_id: currentUser?.id ?? null,
        limit: 120,
      };
      const res = await api.advancedSearch(payload);
      setResult(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-4">
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[260px]">
            <label className="text-xs text-text-muted mb-1 block">Suchbegriffe</label>
            <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nach Notizen, Projekten, Inhalten suchen..." />
          </div>
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input type="checkbox" checked={exactMatch} onChange={(e) => setExactMatch(e.target.checked)} className="accent-accent" />
            Genaue Übereinstimmung
          </label>
          <button className="btn-sm btn-primary" onClick={runSearch}>Suchen</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
          <select title="Zeitraum" className="input-sm" value={period} onChange={(e) => setPeriod(e.target.value as "weekly" | "monthly" | "quarterly" | "custom" | "all") }>
            <option value="all">Alle Zeiträume</option>
            <option value="weekly">Woche</option>
            <option value="monthly">Monat</option>
            <option value="quarterly">Quartal</option>
            <option value="custom">Eigener Zeitraum</option>
          </select>

          <select title="Kategorie" className="input-sm" value={categoryId ?? ""} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Alle Kategorien</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <div>
            <input
              className="input-sm"
              placeholder="Tags filtern..."
              value={tagQuery}
              onChange={(e) => setTagQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && tagSuggestions[0]) {
                  e.preventDefault();
                  addTagId(tagSuggestions[0].id);
                }
              }}
            />
            {(tagSuggestions.length > 0 || tagIds.length > 0) && (
              <div className="mt-1.5 space-y-1">
                {tagSuggestions.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {tagSuggestions.map((tag) => (
                      <button key={tag.id} className="text-[10px] px-2 py-0.5 rounded-full border border-border text-text-muted hover:border-accent/50" onClick={() => addTagId(tag.id)}>
                        + {tag.name}
                      </button>
                    ))}
                  </div>
                )}
                {tagIds.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {tags.filter((t) => tagIds.includes(t.id)).map((tag) => (
                      <button key={tag.id} className="text-[10px] px-2 py-0.5 rounded-full border border-accent bg-accent-muted text-accent" onClick={() => removeTagId(tag.id)}>
                        {tag.name} ×
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <select title="Ersteller" className="input-sm" value={authorId ?? ""} onChange={(e) => setAuthorId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Alle Ersteller</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>

          <select title="Projekt" className="input-sm" value={projectId ?? ""} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Alle Projekte</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <button
            className="btn-sm btn-ghost"
            onClick={() => {
              setQuery("");
              setExactMatch(false);
              setPeriod("all");
              setStartDate("");
              setEndDate("");
              setCategoryId(null);
              setTagQuery("");
              setTagIds([]);
              setAuthorId(null);
              setProjectId(null);
              setResult({ notes: [], projects: [] });
            }}
          >
            Filter zurücksetzen
          </button>
        </div>

        {period === "custom" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input title="Startdatum" className="input-sm" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <input title="Enddatum" className="input-sm" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        )}

        {error && <p className="text-xs text-red-300">{error}</p>}
      </div>

      {loading && <p className="text-sm text-text-muted">Suche läuft...</p>}

      {!loading && (
        <>
          <section className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">Notiz-Treffer ({result.notes.length})</h3>
            {result.notes.length === 0 && <p className="text-xs text-text-muted">Keine Notiz-Treffer.</p>}
            {result.notes.map((entry) => (
              <button
                key={`note-${entry.note.id}`}
                className="w-full text-left card p-3 hover:border-accent/40"
                onClick={() => navigate(`/notes?noteId=${entry.note.id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-text-primary">{entry.note.title}</p>
                  <span className="text-[10px] text-text-muted">{fmtDate(entry.note.created_at)}</span>
                </div>
                <div className="text-[11px] text-text-muted mt-1 flex gap-1.5 flex-wrap">
                  {entry.note.category_name && <Badge>{entry.note.category_name}</Badge>}
                  {entry.note.author_name && <span>{entry.note.author_name}</span>}
                  {entry.note.project_name && <span>• {entry.note.project_name}</span>}
                </div>
                <p className="text-xs text-text-secondary mt-2 leading-relaxed">
                  <HighlightedText text={entry.snippet} query={query} exact={exactMatch} />
                </p>
              </button>
            ))}
          </section>

          <section className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">Projekt-Treffer ({result.projects.length})</h3>
            {result.projects.length === 0 && <p className="text-xs text-text-muted">Keine Projekt-Treffer.</p>}
            {result.projects.map((entry) => (
              <button
                key={`project-${entry.project.id}`}
                className="w-full text-left card p-3 hover:border-accent/40"
                onClick={() => navigate(`/projects?projectId=${entry.project.id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-text-primary">{entry.project.name}</p>
                  <span className="text-[10px] text-text-muted">{fmtDate(entry.project.created_at)}</span>
                </div>
                <div className="text-[11px] text-text-muted mt-1 flex gap-1.5 flex-wrap">
                  {entry.project.owner_name && <span>{entry.project.owner_name}</span>}
                  <Badge>{entry.project.status}</Badge>
                </div>
                <p className="text-xs text-text-secondary mt-2 leading-relaxed">
                  <HighlightedText text={entry.snippet} query={query} exact={exactMatch} />
                </p>
              </button>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
