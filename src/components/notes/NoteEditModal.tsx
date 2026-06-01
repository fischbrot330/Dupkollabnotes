import { useState, useEffect } from "react";
import MDEditor from "@uiw/react-md-editor";
import { Modal } from "../common/Modal";
import type {
  Category, CreateNoteInput, NoteDetail, Tag, Template, UpdateNoteInput, User,
} from "../../types";

interface Props {
  mode: "create" | "edit";
  note?: NoteDetail | null;
  authorId: number;
  categories: Category[];
  tags: Tag[];
  projects: { id: number; name: string }[];
  templates: Template[];
  users: User[];
  canAssignTodos?: boolean;
  initialProjectId?: number | null;
  initialCategoryId?: number | null;
  initialTitle?: string;
  initialContent?: string;
  categoryNameWhitelist?: string[];
  lockProject?: boolean;
  onSave: (data: CreateNoteInput | UpdateNoteInput) => Promise<void>;
  onClose: () => void;
}

export function NoteEditModal({
  mode, note, authorId, categories, tags, projects, templates,
  users, canAssignTodos = false,
  initialProjectId = null, initialCategoryId = null, initialTitle = "", initialContent = "",
  categoryNameWhitelist,
  lockProject = false,
  onSave, onClose,
}: Props) {
  const miscCategory = categories.find((c) => c.name.toLowerCase() === "misc") ?? null;
  const [title, setTitle]     = useState(note?.title ?? initialTitle);
  const [content, setContent] = useState(note?.content ?? initialContent);
  const [catId, setCatId]     = useState<number | null>(note?.category_id ?? initialCategoryId ?? miscCategory?.id ?? null);
  const [projId, setProjId]   = useState<number | null>(note?.project_id ?? initialProjectId);
  const [visibility, setVis]  = useState(note?.visibility ?? "team");
  const [pinned, setPinned]   = useState(note?.is_pinned ?? false);
  const [selTags, setSelTags] = useState<number[]>(note?.tags.map((t) => t.id) ?? []);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [tagQuery, setTagQuery] = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [assignedUserId, setAssignedUserId] = useState<number | null>(note?.assigned_user_id ?? null);
  const [dueDate, setDueDate] = useState(note?.due_date?.slice(0, 10) ?? "");
  const [milestoneDate, setMilestoneDate] = useState(note?.milestone_date?.slice(0, 10) ?? "");

  const filteredCategories = categoryNameWhitelist && categoryNameWhitelist.length > 0
    ? categories.filter((c) => categoryNameWhitelist.some((allowed) => c.name.toLowerCase().includes(allowed.toLowerCase())))
    : categories;

  useEffect(() => {
    if (catId !== null) return;
    const fallback = filteredCategories.find((c) => c.name.toLowerCase() === "misc") ?? filteredCategories[0] ?? null;
    if (fallback) setCatId(fallback.id);
  }, [catId, filteredCategories]);

  const taskCategoryIds = filteredCategories
    .filter((c) => ["aufgabe", "tasks"].includes(c.name.toLowerCase()))
    .map((c) => c.id);
  const isTodoCategory = catId !== null && taskCategoryIds.includes(catId);
  const milestoneCategoryIds = filteredCategories
    .filter((c) => c.name.toLowerCase().includes("milestone"))
    .map((c) => c.id);
  const isMilestoneCategory = catId !== null && milestoneCategoryIds.includes(catId);

  useEffect(() => {
    if (mode !== "create") return;
    if (catId === null) return;
    const templateForCategory = templates.find((t) => t.category_id === catId);
    if (!templateForCategory) return;
    applyTemplate(templateForCategory);
  }, [catId, templates, mode]);

  const tagSuggestions = tags
    .filter((t) => t.name.toLowerCase().includes(tagQuery.trim().toLowerCase()) && !selTags.includes(t.id))
    .slice(0, 8);

  function toggleTag(id: number) {
    setSelTags((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function addTagByName(raw: string) {
    const name = raw.trim();
    if (!name) return;
    const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setSelTags((prev) => (prev.includes(existing.id) ? prev : [...prev, existing.id]));
      setCustomTags((prev) => prev.filter((x) => x.toLowerCase() !== existing.name.toLowerCase()));
    } else {
      setCustomTags((prev) => (prev.some((x) => x.toLowerCase() === name.toLowerCase()) ? prev : [...prev, name]));
    }
    setTagQuery("");
  }

  function removeCustomTag(name: string) {
    setCustomTags((prev) => prev.filter((x) => x !== name));
  }

  function applyTemplate(tpl: Template) {
    setContent(tpl.content);
    if (tpl.category_id) setCatId(tpl.category_id);
  }

  async function handleSave() {
    if (!title.trim()) { setError("Titel ist erforderlich"); return; }
    setSaving(true);
    setError(null);
    try {
      const selectedTagNames = [
        ...tags.filter((t) => selTags.includes(t.id)).map((t) => t.name),
        ...customTags,
      ];
      const selectedCategory = filteredCategories.find((c) => c.id === catId);
      const finalCategory = selectedCategory ?? filteredCategories.find((c) => c.name.toLowerCase() === "misc") ?? filteredCategories[0] ?? null;
      const finalCategoryId = finalCategory?.id ?? null;
      const normalizedCategoryName = (finalCategory?.name ?? "").toLowerCase();
      const mappedNoteType = normalizedCategoryName.includes("aufgabe")
        ? "todo"
        : normalizedCategoryName.includes("kommentar")
          ? "comment"
          : normalizedCategoryName.includes("feedback")
            ? "feedback"
            : normalizedCategoryName.includes("update")
              ? "update"
              : normalizedCategoryName.includes("entscheidung")
                ? "decision"
                : normalizedCategoryName.includes("ankündigung") || normalizedCategoryName.includes("ankuendigung")
                  ? "announcement"
              : "note";
      await onSave({
        title: title.trim(), content, category_id: finalCategoryId,
        project_id: projId, note_type: mappedNoteType, visibility,
        is_pinned: pinned, tag_ids: selTags, tags: selectedTagNames,
        assigned_user_id: assignedUserId,
        due_date: dueDate || null,
        milestone_date: milestoneDate || null,
        is_milestone: isMilestoneCategory,
        ...(mode === "create" ? { author_id: authorId } : {}),
      } as CreateNoteInput);
      onClose();
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={mode === "create" ? "Neue Notiz" : "Notiz bearbeiten"}
      onClose={onClose}
      width="max-w-4xl"
    >
      <div className="p-5 flex flex-col gap-4">
        {error && (
          <p className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded px-3 py-2">
            {error}
          </p>
        )}

        {/* Title */}
        <input
          className="input text-base font-medium"
          placeholder="Titel der Notiz…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />

        {/* Meta row */}
        <div className="flex gap-2 flex-wrap">
          <select title="Kategorie" className="input-sm flex-1" value={catId ?? ""} onChange={(e) => setCatId(e.target.value ? Number(e.target.value) : null)}>
            {filteredCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select title="Projekt" className="input-sm flex-1" value={projId ?? ""} onChange={(e) => setProjId(e.target.value ? Number(e.target.value) : null)} disabled={lockProject}>
            <option value="">Kein Projekt</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select title="Sichtbarkeit" className="input-sm" value={visibility} onChange={(e) => setVis(e.target.value)}>
            <option value="team">Team</option>
            <option value="private">Privat</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="accent-accent" />
            Pinnen
          </label>
        </div>

        {canAssignTodos && isTodoCategory && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted shrink-0">Zuständig:</span>
            <select
              title="Zuständiger Benutzer"
              className="input-sm flex-1"
              value={assignedUserId ?? ""}
              onChange={(e) => setAssignedUserId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Niemand</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
        )}

        {(isTodoCategory || isMilestoneCategory) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Due Date</label>
              <input title="Due Date" className="input-sm" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            {isMilestoneCategory && (
              <div>
                <label className="text-xs text-text-muted mb-1 block">Datum des Milestones</label>
                <input title="Datum des Milestones" className="input-sm" type="date" value={milestoneDate} onChange={(e) => setMilestoneDate(e.target.value)} />
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        <div>
          <label className="text-xs text-text-muted mb-1 block">Tags</label>
          <input
            className="input-sm"
            placeholder="Tag suchen oder neu eingeben (Enter zum Hinzufügen)"
            value={tagQuery}
            onChange={(e) => setTagQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTagByName(tagQuery);
              }
            }}
          />
          {(tagSuggestions.length > 0 || selTags.length > 0 || customTags.length > 0) && (
            <div className="mt-2 space-y-2">
              {tagSuggestions.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {tagSuggestions.map((t) => (
                    <button key={t.id} onClick={() => addTagByName(t.name)} className="text-[11px] px-2 py-0.5 rounded-full border border-border text-text-muted hover:border-accent/50">
                      + {t.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-1.5 flex-wrap">
                {tags.filter((t) => selTags.includes(t.id)).map((t) => (
                  <button key={t.id} onClick={() => toggleTag(t.id)} className="text-[11px] px-2 py-0.5 rounded-full border border-accent bg-accent-muted text-accent">
                    {t.name} ×
                  </button>
                ))}
                {customTags.map((name) => (
                  <button key={name} onClick={() => removeCustomTag(name)} className="text-[11px] px-2 py-0.5 rounded-full border border-accent bg-accent-muted text-accent">
                    {name} ×
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Template picker */}
        {templates.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted shrink-0">Vorlage:</span>
            <select
              title="Vorlage wählen"
              className="input-sm flex-1"
              defaultValue=""
              onChange={(e) => {
                const tpl = templates.find((t) => t.id === Number(e.target.value));
                if (tpl) applyTemplate(tpl);
                e.target.value = "";
              }}
            >
              <option value="">Vorlage wählen…</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}

        {/* MDEditor — the main editor */}
        <div data-color-mode="dark">
          <MDEditor
            value={content}
            onChange={(val) => setContent(val ?? "")}
            height={380}
            preview="live"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 px-5 py-3 border-t border-border bg-bg-surface rounded-b-xl">
        <button onClick={onClose} className="btn-sm btn-ghost">Abbrechen</button>
        <button onClick={handleSave} disabled={saving} className="btn-sm btn-primary">
          {saving ? "Speichern…" : "Speichern"}
        </button>
      </div>
    </Modal>
  );
}
