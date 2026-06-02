import { useState, useMemo } from "react";
import { Archive, CheckCircle2, Circle, Search, Plus, Pin } from "lucide-react";
import type { Category, NoteFilter, NoteSummary, Tag, User } from "../../types";
import { Badge } from "../common/Badge";
import { getDateBucket, getDateBucketRank, groupByItems, sortByRecent } from "../../utils/listViews";

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
}

interface Props {
  notes: NoteSummary[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onNew: () => void;
  filter: NoteFilter;
  onFilterChange: (f: Partial<NoteFilter>) => void;
  categories: Category[];
  tags: Tag[];
  users: User[];
}

export function NotesSidebar({
  notes, selectedId, onSelect, onNew, filter, onFilterChange, categories, tags, users,
}: Props) {
  const [displayMode, setDisplayMode] = useState<"recent" | "category" | "project" | "date">("recent");

  const sortedNotes = useMemo(
    () => sortByRecent(notes, (note) => note.updated_at ?? note.created_at ?? null),
    [notes],
  );

  const groupedNotes = useMemo(() => {
    if (displayMode === "recent") return [];

    const compare = displayMode === "date"
      ? (a: { label: string }, b: { label: string }) => getDateBucketRank(a.label) - getDateBucketRank(b.label) || a.label.localeCompare(b.label)
      : (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, "de-DE");

    return groupByItems(
      sortedNotes,
      (note) => {
        if (displayMode === "category") return note.category_name ?? "Ohne Kategorie";
        if (displayMode === "project") return note.project_name ?? "Ohne Projekt";
        const anchor = note.note_type === "todo" || note.is_milestone
          ? note.due_date ?? note.milestone_date ?? note.updated_at ?? note.created_at ?? null
          : note.updated_at ?? note.created_at ?? null;
        return getDateBucket(anchor);
      },
      (key) => key,
      compare,
    );
  }, [sortedNotes, displayMode]);

  return (
    <aside className="flex flex-col w-72 h-full bg-bg-surface border-r border-border shrink-0">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex-1">
            Notizen
          </span>
          <button onClick={onNew} className="btn-sm btn-primary" title="Neue Notiz">
            <Plus size={13} /> Neu
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            className="input-sm pl-7"
            placeholder="Suchen…"
            value={filter.search ?? ""}
            onChange={(e) => onFilterChange({ search: e.target.value || null })}
          />
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 mt-1.5 flex-wrap">
          <select
            title="Anzeigemodus"
            className="input-sm flex-1 min-w-0"
            value={displayMode}
            onChange={(e) => setDisplayMode(e.target.value as "recent" | "category" | "project" | "date")}
          >
            <option value="recent">Neueste</option>
            <option value="category">Nach Kategorie</option>
            <option value="project">Nach Projekt</option>
            <option value="date">Nach Datum</option>
          </select>
        </div>

        <div className="flex gap-1.5 mt-1.5 flex-wrap">
          <select
            title="Nach Kategorie filtern"
            className="input-sm flex-1 min-w-0"
            value={filter.category_id ?? ""}
            onChange={(e) => onFilterChange({ category_id: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Alle Kategorien</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            title="Nach Autor filtern"
            className="input-sm flex-1 min-w-0"
            value={filter.author_id ?? ""}
            onChange={(e) => onFilterChange({ author_id: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Alle Autoren</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        </div>

        <div className="flex gap-1.5 mt-1.5 flex-wrap">
          <select
            title="Zeitraum der Erstellung"
            className="input-sm flex-1 min-w-0"
            value={filter.period ?? "weekly"}
            onChange={(e) => onFilterChange({ period: e.target.value as "weekly" | "monthly" | "quarterly" | "custom", start_date: null, end_date: null })}
          >
            <option value="weekly">Woche</option>
            <option value="monthly">Monat</option>
            <option value="quarterly">Quartal</option>
            <option value="custom">Eigener Zeitraum</option>
          </select>
        </div>

        {filter.period === "custom" && (
          <div className="grid grid-cols-2 gap-1.5 mt-1.5">
            <input
              title="Startdatum"
              className="input-sm"
              type="date"
              value={filter.start_date ?? ""}
              onChange={(e) => onFilterChange({ start_date: e.target.value || null })}
            />
            <input
              title="Enddatum"
              className="input-sm"
              type="date"
              value={filter.end_date ?? ""}
              onChange={(e) => onFilterChange({ end_date: e.target.value || null })}
            />
          </div>
        )}

        {/* Archive toggle */}
        <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer">
          <input
            type="checkbox"
            className="w-3.5 h-3.5 accent-accent"
            checked={filter.include_archived ?? false}
            onChange={(e) => onFilterChange({ include_archived: e.target.checked })}
          />
          <Archive size={11} className="text-text-muted" />
          <span className="text-[10px] text-text-muted">Archivierte anzeigen</span>
        </label>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1">
        {notes.length === 0 ? (
          <p className="px-4 py-8 text-xs text-text-muted text-center">Keine Notizen gefunden</p>
        ) : displayMode === "recent" ? (
          sortedNotes.map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              isSelected={note.id === selectedId}
              onClick={() => onSelect(note.id)}
            />
          ))
        ) : (
          <div className="space-y-2 px-1.5 py-1.5">
            {groupedNotes.map((group) => (
              <section key={group.key} className="rounded-lg border border-border/70 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-bg-active/60 border-b border-border/70">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary flex-1 truncate">{group.label}</span>
                  <Badge variant={displayMode === "date" ? "update" : "default"}>{group.items.length}</Badge>
                </div>
                <div>
                  {group.items.map((note) => (
                    <NoteRow
                      key={note.id}
                      note={note}
                      isSelected={note.id === selectedId}
                      onClick={() => onSelect(note.id)}
                      dense
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function NoteRow({
  note, isSelected, onClick, dense = false,
}: {
  note: NoteSummary; isSelected: boolean; onClick: () => void;
  dense?: boolean;
}) {
  const isTodo = note.note_type === "todo";
  const isDone = isTodo && Boolean(note.completed_at || note.is_archived);
  const isUserArchived = note.is_user_archived;

  // Subtle category color background
  const catColorStyle = note.category_color
    ? { background: `${note.category_color}14` }
    : {};

  return (
    <button
      onClick={onClick}
      className={`w-full text-left ${dense ? "px-3 py-2" : "px-3 py-2.5"} border-b border-border/50 transition-colors
                  hover:bg-bg-hover group
                  ${isSelected ? "bg-bg-active border-l-2 border-l-accent" : ""}
                  ${isUserArchived ? "opacity-50" : ""}`}
      style={!isSelected ? catColorStyle : undefined}
    >
      <div className="flex items-start gap-1.5">
        {note.is_pinned && <Pin size={10} className="text-accent mt-0.5 shrink-0" />}
        {isTodo && (
          isDone
            ? <CheckCircle2 size={12} className="text-emerald-400 mt-0.5 shrink-0" />
            : <Circle size={12} className="text-violet-400 mt-0.5 shrink-0" />
        )}
        {isUserArchived && <Archive size={10} className="text-amber-400 mt-0.5 shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium truncate ${isSelected ? "text-text-primary" : "text-text-secondary group-hover:text-text-primary"} ${isDone ? "line-through opacity-60" : ""}`}>
            {note.title}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {note.author_name && (
              <span className="text-[10px] text-text-muted">{note.author_name}</span>
            )}
            {note.category_name && (
              <Badge color={(note as any).category_color ?? null}>{note.category_name}</Badge>
            )}
            {isTodo && (
              <Badge variant={isDone ? "update" : "todo"}>{isDone ? "erledigt" : "offen"}</Badge>
            )}
          </div>
          {note.tags.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {note.tags.slice(0, 3).map((t) => (
                <Badge key={t.id} color={t.color}>{t.name}</Badge>
              ))}
            </div>
          )}
          <div className="flex gap-1 mt-1 flex-wrap">
            {(note.open_todos_count ?? 0) > 0 && <Badge variant="todo">{note.open_todos_count} offen</Badge>}
            {(note.done_todos_count ?? 0) > 0 && <Badge variant="update">{note.done_todos_count} erledigt</Badge>}
            {(note.new_comments_count ?? 0) > 0 && <Badge variant="comment">{note.new_comments_count}</Badge>}
            {(note.feedback_count ?? 0) > 0 && <Badge variant="feedback">{note.feedback_count} fb</Badge>}
            {(note.questions_count ?? 0) > 0 && <Badge variant="question">{note.questions_count}</Badge>}
            {(note.updates_count ?? 0) > 0 && <Badge variant="update">{note.updates_count}</Badge>}
          </div>
        </div>
        <span className="text-[10px] text-text-muted shrink-0 ml-1">{fmtDate(note.updated_at)}</span>
      </div>
    </button>
  );
}
