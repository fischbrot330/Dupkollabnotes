import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Category, CreateProjectInput, NoteDetail, ProjectDetail, ProjectSummary, Tag, Template, User } from "../types";
import * as api from "../api";
import { useAppStore } from "../store/useAppStore";
import { ProjectList } from "../components/projects/ProjectList";
import { ProjectDetail as ProjectDetailView } from "../components/projects/ProjectDetail";
import { Modal } from "../components/common/Modal";
import { NoteEditModal } from "../components/notes/NoteEditModal";

interface NoteModalPreset {
  title: string;
  categoryId: number | null;
}

export function ProjectsPage() {
  const currentUser = useAppStore((s) => s.currentUser);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selected, setSelected] = useState<ProjectDetail | null>(null);
  const [search, setSearch] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);

  const [showProjectModal, setShowProjectModal] = useState<"create" | "edit" | null>(null);
  const [noteModalPreset, setNoteModalPreset] = useState<NoteModalPreset | null>(null);

  const [tags, setTags] = useState<Tag[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [fName, setFName] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fStatus, setFStatus] = useState("active");
  const [fMilestone, setFMilestone] = useState("");
  const [fOwner, setFOwner] = useState<number | null>(null);
  const [fTagInput, setFTagInput] = useState("");
  const [fTagNames, setFTagNames] = useState<string[]>([]);

  useEffect(() => {
    loadProjects();
  }, [includeArchived]);

  useEffect(() => {
    api.listTags().then(setTags);
    api.listCategories().then(setCategories);
    api.listTemplates().then(setTemplates);
    api.listUsers().then(setUsers);
  }, []);

  useEffect(() => {
    const rawProjectId = searchParams.get("projectId");
    if (!rawProjectId) return;
    const parsedId = Number(rawProjectId);
    if (!Number.isNaN(parsedId)) {
      selectProject(parsedId);
    }
  }, [searchParams]);

  const allTagNames = useMemo(() => tags.map((t) => t.name), [tags]);
  const taskCategory = useMemo(() => categories.find((c) => c.name.toLowerCase() === "aufgabe") ?? null, [categories]);
  const updateCategory = useMemo(() => categories.find((c) => c.name.toLowerCase() === "update") ?? null, [categories]);
  const meetingCategory = useMemo(() => categories.find((c) => c.name.toLowerCase().includes("meeting")) ?? null, [categories]);
  const milestoneCategory = useMemo(() => categories.find((c) => c.name.toLowerCase() === "milestone") ?? null, [categories]);
  const miscCategory = useMemo(() => categories.find((c) => c.name.toLowerCase() === "misc") ?? null, [categories]);

  const projectTagSuggestions = useMemo(
    () => allTagNames.filter((n) => n.toLowerCase().includes(fTagInput.trim().toLowerCase()) && !fTagNames.includes(n)).slice(0, 8),
    [allTagNames, fTagInput, fTagNames]
  );

  function extractApiMessage(err: unknown): string {
    const raw = String(err);
    const jsonStart = raw.indexOf("{");
    if (jsonStart >= 0) {
      try {
        const parsed = JSON.parse(raw.slice(jsonStart));
        if (parsed.detail) return String(parsed.detail);
      } catch {
        // ignore
      }
    }
    return raw;
  }

  async function ensureTagExists(nameRaw: string): Promise<void> {
    const name = nameRaw.trim();
    if (!name) return;
    if (!allTagNames.includes(name)) {
      const created = await api.createTag({ name, color: null });
      setTags((prev) => [...prev, created]);
    }
  }

  async function loadProjects() {
    const p = await api.listProjects({ search: null, status: null, owner_id: null, include_archived: includeArchived });
    setProjects(p);
  }

  async function selectProject(id: number) {
    try {
      const detail = await api.getProject(id, currentUser?.id ?? null, includeArchived);
      setSelected(detail);
      setFormError(null);
    } catch (e) {
      setFormError(extractApiMessage(e));
      setSelected(null);
    }
  }

  function openCreate() {
    setFName("");
    setFDesc("");
    setFStatus("active");
    setFMilestone("");
    setFOwner(currentUser?.id ?? null);
    setFTagInput("");
    setFTagNames([]);
    setFormError(null);
    setShowProjectModal("create");
  }

  function openEdit() {
    if (!selected) return;
    setFName(selected.name);
    setFDesc(selected.description ?? "");
    setFStatus(selected.status);
    setFMilestone(selected.milestone_date ?? "");
    setFOwner(selected.owner_id ?? null);
    setFTagNames(selected.tags.map((t) => t.name));
    setFTagInput("");
    setFormError(null);
    setShowProjectModal("edit");
  }

  function addProjectTag(raw: string) {
    const name = raw.trim();
    if (!name) return;
    if (!fTagNames.includes(name)) setFTagNames((prev) => [...prev, name]);
    setFTagInput("");
  }

  async function saveProject() {
    if (!fName.trim()) {
      setFormError("Name ist erforderlich");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      for (const tag of fTagNames) {
        await ensureTagExists(tag);
      }

      const payload: CreateProjectInput = {
        name: fName.trim(),
        description: fDesc || null,
        owner_id: fOwner,
        status: fStatus,
        milestone_date: fMilestone || null,
        tags: fTagNames,
      };

      if (showProjectModal === "create") {
        const created = await api.createProject(payload);
        const loaded = await api.getProject(created.id, currentUser?.id ?? null);
        setSelected(loaded);
      } else if (showProjectModal === "edit" && selected) {
        const updated = await api.updateProject(selected.id, payload);
        const loaded = await api.getProject(updated.id, currentUser?.id ?? null);
        setSelected(loaded);
      }

      await loadProjects();
      setShowProjectModal(null);
    } catch (e) {
      setFormError(extractApiMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveProject() {
    if (!selected) return;
    try {
      await api.toggleProjectArchive(selected.id);
      await loadProjects();
      const refreshed = await api.getProject(selected.id, currentUser?.id ?? null, includeArchived);
      setSelected(refreshed);
    } catch (e) {
      setFormError(extractApiMessage(e));
    }
  }

  async function handleArchiveNote(noteId: number) {
    try {
      await api.toggleNoteArchive(noteId);
      if (selected) {
        const refreshed = await api.getProject(selected.id, currentUser?.id ?? null, includeArchived);
        setSelected(refreshed);
      }
    } catch (e) {
      setFormError(extractApiMessage(e));
    }
  }

  async function handleCompleteTask(noteId: number) {
    try {
      await api.completeTaskNote(noteId, currentUser?.id ?? null);
      if (selected) {
        const refreshed = await api.getProject(selected.id, currentUser?.id ?? null);
        setSelected(refreshed);
      }
      await loadProjects();
    } catch (e) {
      setFormError(extractApiMessage(e));
    }
  }

  async function handleCompleteMilestone(noteId: number) {
    try {
      await api.updateNote(noteId, {
        is_archived: true,
        completed_at: new Date().toISOString(),
      });
      if (selected) {
        const refreshed = await api.getProject(selected.id, currentUser?.id ?? null);
        setSelected(refreshed);
      }
      await loadProjects();
    } catch (e) {
      setFormError(extractApiMessage(e));
    }
  }

  function openNoteEditorWithCategory(categoryId: number | null, title: string) {
    if (!selected) return;
    setFormError(null);
    setNoteModalPreset({ categoryId, title });
  }

  async function saveProjectNote(data: any) {
    if (!selected) return;
    const categoryName = categories.find((c) => c.id === (data.category_id ?? miscCategory?.id ?? null))?.name.toLowerCase() ?? "";
    const noteType = categoryName === "aufgabe"
      ? "todo"
      : categoryName === "update"
        ? "update"
        : categoryName === "kommentar"
          ? "comment"
          : categoryName === "feedback"
            ? "feedback"
        : "note";
    await api.createNote({
      ...data,
      project_id: selected.id,
      author_id: currentUser?.id ?? null,
      category_id: data.category_id ?? miscCategory?.id ?? null,
      note_type: data.note_type ?? noteType,
      visibility: data.visibility ?? "team",
    });
    const refreshed = await api.getProject(selected.id, currentUser?.id ?? null);
    setSelected(refreshed);
    await loadProjects();
  }

  const filtered = projects.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex h-full overflow-hidden">
      <ProjectList
        projects={filtered}
        selectedId={selected?.id ?? null}
        onSelect={selectProject}
        onNew={openCreate}
        search={search}
        onSearch={setSearch}
        includeArchived={includeArchived}
        onToggleArchived={() => setIncludeArchived((v) => !v)}
      />

      <div className="flex-1 overflow-hidden">
        {formError && (
          <div className="px-4 pt-3">
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-900/30 rounded px-3 py-2">{formError}</p>
          </div>
        )}
        <ProjectDetailView
          project={selected}
          categories={categories}
          currentUserId={currentUser?.id ?? null}
          includeArchived={includeArchived}
          onEdit={openEdit}
          onOpenTodoModal={() => openNoteEditorWithCategory(taskCategory?.id ?? null, "Neue Aufgabe")}
          onOpenUpdateModal={() => openNoteEditorWithCategory(updateCategory?.id ?? null, "Neues Update")}
          onOpenMeetingModal={() => openNoteEditorWithCategory(meetingCategory?.id ?? null, "Meeting Notes")}
          onOpenMilestoneModal={() => openNoteEditorWithCategory(milestoneCategory?.id ?? null, "Neuer Milestone")}
          onOpenNoteModal={() => openNoteEditorWithCategory(miscCategory?.id ?? null, "Neue Notiz")}
          onOpenNote={(noteId) => navigate(`/notes?noteId=${noteId}`)}
          onCompleteTask={handleCompleteTask}
          onCompleteMilestone={handleCompleteMilestone}
          onArchiveProject={handleArchiveProject}
          onArchiveNote={handleArchiveNote}
        />
      </div>

      {showProjectModal && (
        <Modal title={showProjectModal === "create" ? "Neues Projekt" : "Projekt bearbeiten"} onClose={() => setShowProjectModal(null)}>
          <div className="p-5 flex flex-col gap-3">
            {formError && <p className="text-xs text-red-400 bg-red-900/20 border border-red-900/30 rounded px-3 py-2">{formError}</p>}
            <input className="input" placeholder="Projektname" value={fName} onChange={(e) => setFName(e.target.value)} autoFocus />
            <textarea className="input resize-none" rows={2} placeholder="Beschreibung (optional)" value={fDesc} onChange={(e) => setFDesc(e.target.value)} />
            <div className="flex gap-2">
              <select aria-label="Projektstatus" className="input-sm flex-1" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                <option value="active">Aktiv</option>
                <option value="completed">Abgeschlossen</option>
                <option value="archived">Archiviert</option>
              </select>
              <select aria-label="Projekt-Eigentuemer" className="input-sm flex-1" value={fOwner ?? ""} onChange={(e) => setFOwner(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Kein Eigentümer</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Meilenstein-Datum</label>
              <input aria-label="Meilenstein-Datum" className="input-sm" type="date" value={fMilestone} onChange={(e) => setFMilestone(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Tags</label>
              <input
                className="input-sm"
                placeholder="Tag eingeben und Enter drücken"
                value={fTagInput}
                onChange={(e) => setFTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addProjectTag(fTagInput);
                  }
                }}
              />
              {(projectTagSuggestions.length > 0 || fTagNames.length > 0) && (
                <div className="mt-2 space-y-2">
                  {projectTagSuggestions.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {projectTagSuggestions.map((name) => (
                        <button key={name} onClick={() => addProjectTag(name)} className="text-[11px] px-2 py-0.5 rounded-full border border-border text-text-muted hover:border-accent/50">
                          + {name}
                        </button>
                      ))}
                    </div>
                  )}
                  {fTagNames.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {fTagNames.map((name) => (
                        <button key={name} onClick={() => setFTagNames((prev) => prev.filter((x) => x !== name))} className="text-[11px] px-2 py-0.5 rounded-full border border-accent bg-accent-muted text-accent">
                          {name} ×
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-border bg-bg-surface rounded-b-xl">
            <button onClick={() => setShowProjectModal(null)} className="btn-sm btn-ghost">Abbrechen</button>
            <button onClick={saveProject} disabled={saving} className="btn-sm btn-primary">{saving ? "Speichern…" : "Speichern"}</button>
          </div>
        </Modal>
      )}

      {noteModalPreset && selected && (
        <NoteEditModal
          mode="create"
          note={null}
          authorId={currentUser?.id ?? 0}
          categories={categories}
          tags={tags}
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          templates={templates}
          users={users}
          canAssignTodos={Boolean(currentUser?.can_manage_projects)}
          initialTitle={noteModalPreset.title}
          initialProjectId={selected.id}
          initialCategoryId={noteModalPreset.categoryId}
          categoryNameWhitelist={["aufgabe", "update", "meeting", "misc", "milestone"]}
          lockProject
          onSave={saveProjectNote}
          onClose={() => setNoteModalPreset(null)}
        />
      )}
    </div>
  );
}
