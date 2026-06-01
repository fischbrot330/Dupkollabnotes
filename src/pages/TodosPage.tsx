import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, CheckSquare, Clock3, Filter, ListTodo } from "lucide-react";
import type { Category, NoteSummary, User } from "../types";
import * as api from "../api";
import { useAppStore } from "../store/useAppStore";
import { Badge } from "../components/common/Badge";
import { getDateBucket, getDateBucketRank, groupByItems, sortByRecent } from "../utils/listViews";

function fmtDate(iso?: string | null) {
  if (!iso) return "kein Due Date";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
}

function isOverdue(iso?: string | null) {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

interface Group {
  key: string;
  label: string;
  items: NoteSummary[];
}

export function TodosPage() {
  const navigate = useNavigate();
  const currentUser = useAppStore((s) => s.currentUser);

  const [todos, setTodos] = useState<NoteSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);

  const [search, setSearch] = useState("");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [authorId, setAuthorId] = useState<number | null>(null);
  const [groupBy, setGroupBy] = useState<"date" | "project" | "category">("date");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.listCategories(),
      api.listUsers(),
      api.listProjects({ search: null, status: null, owner_id: null }),
    ]).then(([cats, usrs, projs]) => {
      setCategories(cats);
      setUsers(usrs);
      setProjects(projs.map((p) => ({ id: p.id, name: p.name })));
    });
  }, []);

  async function loadTodos() {
    setLoading(true);
    try {
      const list = await api.listTodoBoard({
        search: search || null,
        status: "all",
        category_id: categoryId,
        project_id: projectId,
        viewer_id: currentUser?.id ?? null,
      });
      setTodos(list);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTodos();
  }, [projectId, categoryId, authorId, search, currentUser?.id]);

  const visibleTodos = useMemo(
    () => todos.filter((t) => (authorId == null ? true : t.author_id === authorId)),
    [todos, authorId]
  );

  function makeGroups(items: NoteSummary[]): Group[] {
    const sorted = sortByRecent(items, (t) => t.due_date ?? t.completed_at ?? t.updated_at ?? t.created_at ?? null);
    const groups = groupByItems(
      sorted,
      (t) => {
        if (groupBy === "project") return t.project_name || "Ohne Projekt";
        if (groupBy === "category") return t.category_name || "Ohne Kategorie";
        const anchor = t.is_archived ? t.completed_at : t.due_date ?? t.completed_at ?? t.updated_at ?? t.created_at ?? null;
        return getDateBucket(anchor);
      },
      (key) => key,
      groupBy === "date"
        ? (a, b) => getDateBucketRank(a.label) - getDateBucketRank(b.label) || a.label.localeCompare(b.label, "de-DE")
        : (a, b) => a.label.localeCompare(b.label, "de-DE"),
    );

    return groups;
  }

  const openTodos = useMemo(() => visibleTodos.filter((t) => !t.is_archived), [visibleTodos]);
  const doneTodos = useMemo(() => visibleTodos.filter((t) => !!t.is_archived), [visibleTodos]);

  const openGrouped = useMemo(() => makeGroups(openTodos), [openTodos, groupBy]);
  const doneGrouped = useMemo(() => makeGroups(doneTodos), [doneTodos, groupBy]);

  const stats = useMemo(() => {
    const open = visibleTodos.filter((t) => !t.is_archived);
    return {
      open: open.length,
      done: visibleTodos.filter((t) => !!t.is_archived).length,
      overdue: open.filter((t) => isOverdue(t.due_date)).length,
      dueSoon: open.filter((t) => t.due_date && !isOverdue(t.due_date) && new Date(t.due_date).getTime() - Date.now() <= 3 * 24 * 3600 * 1000).length,
      withoutDate: open.filter((t) => !t.due_date).length,
    };
  }, [visibleTodos]);

  async function completeTodo(todo: NoteSummary) {
    await api.completeTaskNote(todo.id, currentUser?.id ?? null);
    await loadTodos();
  }

  return (
    <div className="h-full flex flex-col overflow-hidden p-4 gap-3">
      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 shrink-0">
        <div className="card p-3">
          <p className="text-xs text-text-muted">Offen</p>
          <p className="text-xl font-semibold text-text-primary mt-1">{stats.open}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-text-muted">Erledigt</p>
          <p className="text-xl font-semibold text-emerald-400 mt-1">{stats.done}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-text-muted">Überfällig</p>
          <p className="text-xl font-semibold text-red-400 mt-1">{stats.overdue}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-text-muted">Due in 3 Tagen</p>
          <p className="text-xl font-semibold text-amber-300 mt-1">{stats.dueSoon}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-text-muted">Ohne Due Date</p>
          <p className="text-xl font-semibold text-text-primary mt-1">{stats.withoutDate}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card p-3 shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
          <input
            className="input-sm xl:col-span-2"
            placeholder="Aufgaben durchsuchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select title="Projekt" className="input-sm" value={projectId ?? ""} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Alle Projekte</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select title="Kategorie" className="input-sm" value={categoryId ?? ""} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Alle Kategorien</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select title="Ersteller" className="input-sm" value={authorId ?? ""} onChange={(e) => setAuthorId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Alle Ersteller</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <button className={`btn-sm ${groupBy === "date" ? "btn-primary" : "btn-ghost"}`} onClick={() => setGroupBy("date")}>Nach Datum</button>
          <button className={`btn-sm ${groupBy === "project" ? "btn-primary" : "btn-ghost"}`} onClick={() => setGroupBy("project")}>Nach Projekt</button>
          <button className={`btn-sm ${groupBy === "category" ? "btn-primary" : "btn-ghost"}`} onClick={() => setGroupBy("category")}>Nach Kategorie</button>
          <button className="btn-sm btn-ghost ml-auto" onClick={loadTodos}>Aktualisieren</button>
          <button className="btn-sm btn-ghost" onClick={() => { setSearch(""); setProjectId(null); setCategoryId(null); setAuthorId(null); }}>Reset</button>
        </div>
      </div>

      {loading && <p className="text-sm text-text-muted shrink-0">Lade Aufgaben...</p>}

      {/* Two-column split: open (left) | done (right) */}
      {!loading && (
        <div className="flex flex-1 overflow-hidden gap-3">
          {/* Left: open todos */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-bg-surface border border-border rounded-t-lg shrink-0">
              <CheckSquare size={14} className="text-violet-400" />
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex-1">Offen</span>
              <Badge variant="todo">{stats.open}</Badge>
            </div>
            <div className="flex-1 overflow-y-auto border-x border-b border-border rounded-b-lg space-y-2 p-2">
              {openGrouped.length === 0 && (
                <p className="text-xs text-text-muted py-6 text-center">Keine offenen Aufgaben</p>
              )}
              {openGrouped.map((group) => (
                <TodoGroup key={group.key} group={group} navigate={navigate} completeTodo={completeTodo} isOpen />
              ))}
            </div>
          </div>

          {/* Right: done todos */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-bg-surface border border-border rounded-t-lg shrink-0">
              <CheckSquare size={14} className="text-emerald-400" />
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex-1">Erledigt</span>
              <Badge variant="update">{stats.done}</Badge>
            </div>
            <div className="flex-1 overflow-y-auto border-x border-b border-border rounded-b-lg space-y-2 p-2">
              {doneGrouped.length === 0 && (
                <p className="text-xs text-text-muted py-6 text-center">Keine erledigten Aufgaben</p>
              )}
              {doneGrouped.map((group) => (
                <TodoGroup key={group.key} group={group} navigate={navigate} completeTodo={completeTodo} isOpen={false} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TodoGroup({
  group,
  navigate,
  completeTodo,
  isOpen,
}: {
  group: { key: string; label: string; items: import("../types").NoteSummary[] };
  navigate: (path: string) => void;
  completeTodo: (todo: import("../types").NoteSummary) => Promise<void>;
  isOpen: boolean;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="px-3 py-1.5 border-b border-border flex items-center gap-2">
        <ListTodo size={12} className="text-text-muted" />
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex-1 truncate">{group.label}</span>
        <Badge variant={isOpen ? "todo" : "update"}>{group.items.length}</Badge>
      </div>
      <div className="divide-y divide-border/50">
        {group.items.map((todo) => (
          <article key={todo.id} className="px-3 py-2.5 hover:bg-bg-hover transition-colors">
            <div className="flex items-start gap-2">
              <button
                className="mt-0.5 shrink-0"
                title={todo.is_archived ? "Bereits erledigt" : "Als erledigt markieren"}
                onClick={() => !todo.is_archived && completeTodo(todo)}
              >
                <CheckSquare size={15} className={todo.is_archived ? "text-emerald-400" : "text-text-muted hover:text-emerald-400"} />
              </button>
              <button className="text-left min-w-0 flex-1" onClick={() => navigate(`/notes?noteId=${todo.id}`)}>
                <p className={`text-sm ${todo.is_archived ? "line-through text-text-muted" : "text-text-primary"}`}>{todo.title}</p>
                <div className="mt-0.5 text-[11px] text-text-muted flex items-center gap-1.5 flex-wrap">
                  {todo.author_name && <span>{todo.author_name}</span>}
                  {todo.project_name && <span>• {todo.project_name}</span>}
                  {todo.due_date && (
                    <span className={`inline-flex items-center gap-1 ${isOverdue(todo.due_date) && !todo.is_archived ? "text-red-300" : todo.is_archived ? "text-emerald-400" : "text-sky-300"}`}>
                      <Clock3 size={10} /> {fmtDate(todo.due_date)}
                    </span>
                  )}
                  {todo.is_archived && todo.completed_at && (
                    <span className="text-emerald-400">✓ {fmtDate(todo.completed_at)}</span>
                  )}
                </div>
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
