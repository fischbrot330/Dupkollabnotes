import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type {
  Category, CreateNoteInput, NoteDetail, NoteFilter,
  NoteSummary, Tag, Template, UpdateNoteInput, User,
} from "../types";
import * as api from "../api";
import { useAppStore } from "../store/useAppStore";
import { NotesSidebar } from "../components/notes/NotesSidebar";
import { NoteViewer } from "../components/notes/NoteViewer";
import { NoteEditModal } from "../components/notes/NoteEditModal";
import { NoteContextSidebar } from "../components/notes/NoteContextSidebar";

const DEFAULT_FILTER: NoteFilter = {
  search: null, category_id: null, project_id: null,
  author_id: null, viewer_id: null, note_type: null, tag_id: null,
  period: "weekly", start_date: null, end_date: null,
};

export function NotesPage() {
  const currentUser = useAppStore((s) => s.currentUser);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [notes, setNotes]           = useState<NoteSummary[]>([]);
  const [selectedNote, setSelected] = useState<NoteDetail | null>(null);
  const [filter, setFilter]         = useState<NoteFilter>(DEFAULT_FILTER);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags]             = useState<Tag[]>([]);
  const [users, setUsers]           = useState<User[]>([]);
  const [templates, setTemplates]   = useState<Template[]>([]);
  const [projects, setProjects]     = useState<{ id: number; name: string }[]>([]);
  const [showModal, setShowModal]   = useState<"create" | "edit" | null>(null);
  const [loading, setLoading]       = useState(false);

  useEffect(() => {
    setFilter((prev) => ({ ...prev, viewer_id: currentUser?.id ?? null }));
  }, [currentUser?.id]);

  // Load reference data once
  useEffect(() => {
    Promise.all([
      api.listCategories(),
      api.listTags(),
      api.listUsers(),
      api.listTemplates(),
      api.listProjects({ search: null, status: null, owner_id: null }),
    ]).then(([cats, tgs, usrs, tpls, projs]) => {
      setCategories(cats);
      setTags(tgs);
      setUsers(usrs);
      setTemplates(tpls);
      setProjects(projs.map((p) => ({ id: p.id, name: p.name })));
    });
  }, []);

  // Reload notes when filter changes
  useEffect(() => {
    setLoading(true);
    api.listNotes(filter).then(setNotes).finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    const noteIdRaw = searchParams.get("noteId");
    if (!noteIdRaw) return;
    const noteId = Number(noteIdRaw);
    if (!Number.isNaN(noteId)) {
      selectNote(noteId);
    }
  }, [searchParams]);

  async function selectNote(id: number) {
    const detail = await api.getNote(id, currentUser?.id ?? null);
    setSelected(detail);
  }

  async function handleSave(data: CreateNoteInput | UpdateNoteInput) {
    if (showModal === "create") {
      await api.createNote(data as CreateNoteInput);
    } else if (showModal === "edit" && selectedNote) {
      const updated = await api.updateNote(selectedNote.id, data as UpdateNoteInput);
      setSelected(updated);
    }
    const refreshed = await api.listNotes(filter);
    setNotes(refreshed);
  }

  async function handleDelete() {
    if (!selectedNote || !window.confirm(`"${selectedNote.title}" wirklich löschen?`)) return;
    await api.deleteNote(selectedNote.id);
    setSelected(null);
    setNotes((prev) => prev.filter((n) => n.id !== selectedNote.id));
  }

  async function handleCompleteTask(noteId: number) {
    await api.completeTaskNote(noteId, currentUser?.id ?? null);
    const refreshed = await api.listNotes(filter);
    setNotes(refreshed);
    if (selectedNote?.id === noteId) {
      const updated = await api.getNote(noteId, currentUser?.id ?? null);
      setSelected(updated);
    }
  }

  async function handleArchiveToggle(noteId: number) {
    await api.toggleNoteArchive(noteId);
    const refreshed = await api.listNotes(filter);
    setNotes(refreshed);
    if (selectedNote?.id === noteId) {
      const updated = await api.getNote(noteId, currentUser?.id ?? null);
      setSelected(updated);
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar: filterable notes list */}
      <NotesSidebar
        notes={notes}
        selectedId={selectedNote?.id ?? null}
        onSelect={selectNote}
        onNew={() => setShowModal("create")}
        filter={filter}
        onFilterChange={(f) => setFilter((prev) => ({ ...prev, ...f }))}
        categories={categories}
        tags={tags}
        users={users}
      />

      {/* Main: note viewer + comment panel */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-hidden border-r border-border">
          <NoteViewer
            note={selectedNote}
            currentUserId={currentUser?.id ?? null}
            onEdit={() => setShowModal("edit")}
            onDelete={handleDelete}
            onCompleteTask={handleCompleteTask}
            onOpenProject={(projectId) => navigate(`/projects?projectId=${projectId}`)}
            onArchiveToggle={handleArchiveToggle}
          />
        </div>

        {/* Kontext-Sidebar rechts neben der Notiz */}
        {selectedNote && currentUser && (
          <div className="w-[360px] max-w-[40%] min-w-[300px] h-full">
            <NoteContextSidebar noteId={selectedNote.id} currentUserId={currentUser.id} />
          </div>
        )}
      </div>

      {/* Create/Edit modal */}
      {showModal && (
        <NoteEditModal
          mode={showModal}
          note={showModal === "edit" ? selectedNote : null}
          authorId={currentUser?.id ?? 0}
          categories={categories}
          tags={tags}
          projects={projects}
          templates={templates}
          users={users}
          canAssignTodos={Boolean(currentUser?.can_manage_projects)}
          initialProjectId={searchParams.get("projectId") ? Number(searchParams.get("projectId")) : null}
          onSave={handleSave}
          onClose={() => setShowModal(null)}
        />
      )}
    </div>
  );
}
