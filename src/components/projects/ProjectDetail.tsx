import { useMemo, useState } from "react";
import {
  Archive, CheckSquare, Square, Pencil, FolderKanban,
  Milestone, MessageSquare, Clock, Mail,
} from "lucide-react";
import MDEditor from "@uiw/react-md-editor";
import type { Category, ProjectDetail, UpdateItem } from "../../types";
import { Badge } from "../common/Badge";
import { NoteContextSidebar } from "../notes/NoteContextSidebar";
import { getDateBucket, getDateBucketRank, groupByItems, sortByRecent } from "../../utils/listViews";
import * as api from "../../api";

function fmtDt(iso: string) {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "2-digit" });
}

function dueDateClass(due: string | null | undefined, isDone: boolean): string {
  if (isDone) return "text-emerald-400";
  if (!due) return "text-text-muted";
  const ms = new Date(due).getTime() - Date.now();
  if (ms < 0) return "text-red-400";
  if (ms < 3 * 24 * 3600 * 1000) return "text-amber-300";
  return "text-sky-300";
}

function itemKind(item: UpdateItem): "todo" | "milestone" | "milestone_done" | "update" | "note" {
  if (item.is_milestone) return item.is_archived ? "milestone_done" : "milestone";
  const cat = (item.category_name ?? "").toLowerCase();
  if (cat === "aufgabe" || item.note_type === "todo") return "todo";
  if (item.note_type === "update" || cat === "update") return "update";
  return "note";
}

const KIND_DOT: Record<string, string> = {
  todo: "bg-violet-500 border-violet-600",
  milestone: "bg-amber-400 border-amber-500",
  milestone_done: "bg-emerald-500 border-emerald-600",
  update: "bg-teal-500 border-teal-600",
  note: "bg-sky-500 border-sky-600",
};

const KIND_BADGE_VARIANT: Record<string, "todo" | "update" | "default" | "comment"> = {
  todo: "todo",
  milestone: "update",
  milestone_done: "default",
  update: "update",
  note: "default",
};

const KIND_LABEL: Record<string, string> = {
  todo: "Aufgabe",
  milestone: "Milestone",
  milestone_done: "Milestone ✓",
  update: "Update",
  note: "Notiz",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Aktiv", completed: "Abgeschlossen", archived: "Archiviert",
};

type ListMode = "recent" | "category" | "date";

interface Props {
  project: ProjectDetail | null;
  categories: Category[];
  currentUserId: number | null;
  includeArchived?: boolean;
  onEdit: () => void;
  onOpenTodoModal: () => void;
  onOpenUpdateModal: () => void;
  onOpenMeetingModal: () => void;
  onOpenMilestoneModal: () => void;
  onOpenNoteModal: () => void;
  onOpenNote: (noteId: number) => void;
  onCompleteTask: (noteId: number) => void;
  onCompleteMilestone: (noteId: number) => void;
  onArchiveProject?: () => void;
  onArchiveNote?: (noteId: number) => void;
}

export function ProjectDetail({
  project,
  currentUserId,
  onEdit,
  onOpenTodoModal,
  onOpenUpdateModal,
  onOpenMeetingModal,
  onOpenMilestoneModal,
  onOpenNoteModal,
  onOpenNote,
  onCompleteTask,
  onCompleteMilestone,
  onArchiveProject,
  onArchiveNote,
}: Props) {
  const [focusedNoteId, setFocusedNoteId] = useState<number | null>(null);
  const [updatesView, setUpdatesView] = useState<"list" | "timeline">("list");
  const [listMode, setListMode] = useState<ListMode>("category");

  const updates = project?.updates ?? [];
  const milestones = project?.milestones ?? [];

  // All items merged: updates (incl. tasks) + milestones
  const allItems = useMemo((): UpdateItem[] => [...updates, ...milestones], [updates, milestones]);

  const allSorted = useMemo(
    () =>
      [...allItems].sort(
        (a, b) =>
          new Date(b.updated_at ?? b.created_at).getTime() -
          new Date(a.updated_at ?? a.created_at).getTime(),
      ),
    [allItems],
  );

  const listGroups = useMemo(() => {
    if (listMode === "recent") return [];

    const sorted = sortByRecent(allItems, (item) => item.updated_at ?? item.created_at);
    return groupByItems(
      sorted,
      (item) => {
        if (listMode === "category") return item.category_name ?? "Ohne Kategorie";
        const anchor = item.is_milestone
          ? item.milestone_date ?? item.due_date ?? item.updated_at ?? item.created_at
          : item.due_date ?? item.updated_at ?? item.created_at;
        return getDateBucket(anchor);
      },
      (key) => key,
      listMode === "date"
        ? (a, b) => getDateBucketRank(a.label) - getDateBucketRank(b.label) || a.label.localeCompare(b.label, "de-DE")
        : (a, b) => a.label.localeCompare(b.label, "de-DE"),
    );
  }, [allItems, listMode]);

  const timelineItems = useMemo(() => {
    return [...allItems]
      .map((item) => {
        const kind = itemKind(item);
        const effectiveDate =
          kind === "milestone" || kind === "milestone_done"
            ? item.milestone_date ?? item.updated_at ?? item.created_at
            : item.updated_at ?? item.created_at;
        return { item, kind, effectiveDate };
      })
      .filter((x) => Boolean(x.effectiveDate))
      .sort((a, b) => new Date(a.effectiveDate!).getTime() - new Date(b.effectiveDate!).getTime());
  }, [allItems]);

  const selectedEntry = focusedNoteId ? allItems.find((e) => e.id === focusedNoteId) ?? null : null;

  async function openSelectedAsMail() {
    if (!selectedEntry) return;
    try {
      await api.openOutlookDraft(selectedEntry.title || "Projekt-Notiz", selectedEntry.content || "");
    } catch (e) {
      window.alert(`Outlook-Mail konnte nicht geöffnet werden: ${String(e)}`);
    }
  }

  function renderListItem(item: UpdateItem) {
    const kind = itemKind(item);
    const isDone = !!item.is_archived;
    const dueDate = item.due_date ?? (kind === "milestone" || kind === "milestone_done" ? item.milestone_date : null);
    const dueClass = dueDateClass(dueDate, isDone);
    const isFocused = focusedNoteId === item.id;

    return (
      <button
        key={item.id}
        onClick={() => setFocusedNoteId(item.id)}
        className={`w-full text-left card p-2.5 hover:border-accent/40 transition-colors
          ${isFocused ? "border-accent/60 bg-accent-muted/20" : ""}
          ${isDone && kind !== "milestone_done" ? "opacity-60" : ""}`}
      >
        <div className="flex items-start gap-2">
          <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 border ${KIND_DOT[kind]}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-medium text-text-primary truncate ${isDone && kind === "todo" ? "line-through opacity-60" : ""}`}>
              {item.title || "—"}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <Badge variant={KIND_BADGE_VARIANT[kind]}>{KIND_LABEL[kind]}</Badge>
              {dueDate && (
                <span className={`text-[10px] flex items-center gap-0.5 ${dueClass}`}>
                  <Clock size={9} /> {fmtDate(dueDate)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-text-muted">
              {item.author_name && <span>{item.author_name}</span>}
              <span className="shrink-0">{fmtDt(item.updated_at ?? item.created_at)}</span>
            </div>
          </div>
          {kind === "todo" && !isDone && (
            <button
              className="shrink-0 mt-0.5"
              title="Als erledigt markieren"
              onClick={(e) => { e.stopPropagation(); onCompleteTask(item.id); }}
            >
              <Square size={14} className="text-text-muted hover:text-emerald-400" />
            </button>
          )}
          {kind === "todo" && isDone && <CheckSquare size={14} className="text-emerald-400 shrink-0 mt-0.5" />}
          {kind === "milestone" && (
            <button
              className="shrink-0 mt-0.5"
              title="Milestone abschließen"
              onClick={(e) => { e.stopPropagation(); onCompleteMilestone(item.id); }}
            >
              <Milestone size={14} className="text-text-muted hover:text-amber-400" />
            </button>
          )}
          {kind === "milestone_done" && <Milestone size={14} className="text-emerald-400 shrink-0 mt-0.5" />}
        </div>
      </button>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-muted select-none">
        <FolderKanban size={44} className="mb-3 opacity-20" />
        <p className="text-sm">Projekt auswählen</p>
      </div>
    );
  }

  const isOwner = project.owner_id === currentUserId;
  const openTaskCount = updates.filter(
    (u) => ((u.category_name ?? "").toLowerCase() === "aufgabe" || u.note_type === "todo") && !u.is_archived,
  ).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-text-primary">{project.name}</h2>
              {(project as any).is_user_archived && (
                <Badge variant="default"><Archive size={10} className="inline mr-0.5" />Archiviert</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-text-muted">{STATUS_LABELS[project.status]}</span>
              {project.owner_name && <span className="text-xs text-text-muted">• {project.owner_name}</span>}
              {project.milestone_date && (
                <span className="text-xs text-text-muted">• Meilenstein: {project.milestone_date.slice(0, 10)}</span>
              )}
              <span className="text-xs text-text-muted">• {openTaskCount} Aufgaben offen</span>
            </div>
            {project.tags.length > 0 && (
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {project.tags.map((t) => <Badge key={t.id} color={t.color}>{t.name}</Badge>)}
              </div>
            )}
            <div className="flex gap-1.5 mt-2 flex-wrap">
              <button onClick={onOpenTodoModal} className="btn-sm btn-primary">
                <Square size={12} /> Aufgabe
              </button>
              <button onClick={onOpenUpdateModal} className="btn-sm btn-ghost">
                <MessageSquare size={12} /> Update
              </button>
              <button onClick={onOpenMeetingModal} className="btn-sm btn-ghost">
                <MessageSquare size={12} /> Meeting
              </button>
              <button onClick={onOpenMilestoneModal} className="btn-sm btn-ghost">
                <Milestone size={12} /> Milestone
              </button>
              <button onClick={onOpenNoteModal} className="btn-sm btn-ghost">
                <Pencil size={12} /> Notiz
              </button>
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
            <button
              onClick={onArchiveProject}
              className={`btn-sm ${(project as any).is_user_archived ? "btn-primary" : "btn-ghost"}`}
              title={(project as any).is_user_archived ? "Aus Archiv holen" : "Projekt archivieren"}
            >
              <Archive size={13} /> {(project as any).is_user_archived ? "Entarchivieren" : "Archivieren"}
            </button>
            {isOwner && (
              <button onClick={onEdit} className="btn-sm btn-primary">
                <Pencil size={13} /> Bearbeiten
              </button>
            )}
          </div>
        </div>
        {project.description && (
          <p className="text-sm text-text-secondary mt-2 leading-relaxed">{project.description}</p>
        )}
      </div>

      {/* Body: left = all items list/timeline, right = preview + context */}
      <div className="flex flex-1 overflow-hidden divide-x divide-border">
        {/* ── Left: unified items column ── */}
        <div className="flex flex-col w-[300px] min-w-[260px] max-w-[28%] overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex-1">
              Einträge <span className="text-text-muted font-normal normal-case">({allItems.length})</span>
            </span>
            <div className="inline-flex rounded border border-border overflow-hidden">
              <button
                onClick={() => setUpdatesView("list")}
                className={`px-2 py-1 text-[10px] ${updatesView === "list" ? "bg-accent-muted text-accent" : "text-text-muted"}`}
              >
                Liste
              </button>
              <button
                onClick={() => setUpdatesView("timeline")}
                className={`px-2 py-1 text-[10px] ${updatesView === "timeline" ? "bg-accent-muted text-accent" : "text-text-muted"}`}
              >
                Timeline
              </button>
            </div>
          </div>

          {/* List view */}
          {updatesView === "list" && (
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap pb-1.5">
                <button onClick={() => setListMode("category")} className={`btn-sm ${listMode === "category" ? "btn-primary" : "btn-ghost"}`}>Kategorie</button>
                <button onClick={() => setListMode("date")} className={`btn-sm ${listMode === "date" ? "btn-primary" : "btn-ghost"}`}>Datum</button>
                <button onClick={() => setListMode("recent")} className={`btn-sm ${listMode === "recent" ? "btn-primary" : "btn-ghost"}`}>Neueste</button>
              </div>

              {listMode === "recent" ? (
                allSorted.length === 0 ? (
                  <p className="text-xs text-text-muted py-6 text-center">Noch keine Einträge</p>
                ) : (
                  <div className="space-y-1.5">
                    {allSorted.map((item) => renderListItem(item))}
                  </div>
                )
              ) : (
                <>
                  {listGroups.length === 0 && <p className="text-xs text-text-muted py-6 text-center">Noch keine Einträge</p>}
                  <div className="space-y-2">
                    {listGroups.map((group) => (
                      <section key={group.key} className="rounded-lg border border-border/70 overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2 bg-bg-active/50 border-b border-border/70">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary flex-1 truncate">{group.label}</span>
                          <Badge variant={listMode === "date" ? "update" : "default"}>{group.items.length}</Badge>
                        </div>
                        <div className="space-y-1.5 p-1.5">
                          {group.items.map((item) => renderListItem(item))}
                        </div>
                      </section>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Timeline view */}
          {updatesView === "timeline" && (
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {timelineItems.length === 0 && (
                <p className="text-xs text-text-muted py-6 text-center">Noch keine Events</p>
              )}
              {timelineItems.length > 0 && (
                <div className="relative pl-5">
                  <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />
                  <div className="flex flex-col gap-3">
                    {timelineItems.map(({ item, kind, effectiveDate }) => {
                      const isDone = !!item.is_archived;
                      const dueDate = item.due_date ?? (kind === "milestone" || kind === "milestone_done" ? item.milestone_date : null);
                      const dueClass = dueDateClass(dueDate, isDone);
                      return (
                        <button
                          key={`${kind}-${item.id}`}
                          onClick={() => setFocusedNoteId(item.id)}
                          className={`card p-2.5 text-left hover:border-accent/40 relative transition-colors
                            ${focusedNoteId === item.id ? "border-accent/60 bg-accent-muted/20" : ""}`}
                        >
                          <span
                            className={`absolute -left-[18px] top-3.5 w-3 h-3 rounded-full border-2 border-bg-surface ${KIND_DOT[kind]}`}
                          />
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-xs font-semibold text-text-primary ${isDone && kind === "todo" ? "line-through opacity-60" : ""}`}>
                              {item.title || "—"}
                            </p>
                            <span className="text-[10px] text-text-muted shrink-0">{fmtDt(effectiveDate!)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <Badge variant={KIND_BADGE_VARIANT[kind]}>{KIND_LABEL[kind]}</Badge>
                            {item.category_name && <span className="text-[10px] text-text-muted">{item.category_name}</span>}
                            {dueDate && (
                              <span className={`text-[10px] flex items-center gap-0.5 ${dueClass}`}>
                                <Clock size={9} /> {fmtDate(dueDate)}
                              </span>
                            )}
                            {item.author_name && <span className="text-[10px] text-text-muted">• {item.author_name}</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: preview (wide) + NoteContextSidebar ── */}
        <div className="flex-1 flex overflow-hidden">
          {/* Preview panel */}
          <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
              <MessageSquare size={13} className="text-text-muted" />
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex-1 truncate">
                {selectedEntry ? selectedEntry.title : "Vorschau"}
              </span>
              {selectedEntry && (
                <div className="flex gap-1.5 shrink-0">
                  {onArchiveNote && (
                    <button
                      className={`btn-sm ${selectedEntry.is_user_archived ? "btn-primary" : "btn-ghost"}`}
                      onClick={() => onArchiveNote(selectedEntry.id)}
                    >
                      <Archive size={12} />
                      {selectedEntry.is_user_archived ? "Entarchivieren" : "Archivieren"}
                    </button>
                  )}
                  <button className="btn-sm btn-ghost" onClick={() => onOpenNote(selectedEntry.id)}>
                    Notiz öffnen
                  </button>
                  <button className="btn-sm btn-ghost" onClick={openSelectedAsMail}>
                    <Mail size={12} /> Mail
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {!selectedEntry ? (
                <p className="text-xs text-text-muted mt-8 text-center opacity-60">Eintrag links auswählen</p>
              ) : (
                <>
                  <div className="flex items-start gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {selectedEntry.author_name && (
                          <span className="text-xs text-text-muted">von {selectedEntry.author_name}</span>
                        )}
                        {selectedEntry.category_name && <Badge>{selectedEntry.category_name}</Badge>}
                        {selectedEntry.visibility && (
                          <Badge>{selectedEntry.visibility === "private" ? "Privat" : "Team"}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {selectedEntry.due_date && (
                          <span className={`text-xs flex items-center gap-1 ${dueDateClass(selectedEntry.due_date, !!selectedEntry.is_archived)}`}>
                            <Clock size={11} /> Due: {selectedEntry.due_date.slice(0, 10)}
                          </span>
                        )}
                        {selectedEntry.milestone_date && (
                          <span className="text-xs text-amber-300 flex items-center gap-1">
                            <Milestone size={11} /> Ziel: {selectedEntry.milestone_date.slice(0, 10)}
                          </span>
                        )}
                        {selectedEntry.completed_at && (
                          <span className="text-xs text-emerald-400">✓ {selectedEntry.completed_at.slice(0, 10)}</span>
                        )}
                        <span className="text-xs text-text-muted">
                          {fmtDt(selectedEntry.updated_at ?? selectedEntry.created_at)}
                        </span>
                      </div>
                      {itemKind(selectedEntry) === "todo" && !selectedEntry.is_archived && (
                        <button className="btn-sm btn-primary mt-2" onClick={() => onCompleteTask(selectedEntry.id)}>
                          Als erledigt markieren
                        </button>
                      )}
                    </div>
                  </div>
                  <div data-color-mode="dark">
                    <MDEditor.Markdown
                      source={selectedEntry.content || "*Kein Inhalt*"}
                      style={{ background: "transparent" }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Context sidebar — only when a note is selected */}
          {focusedNoteId && currentUserId && (
            <div className="w-[340px] max-w-[38%] min-w-[280px] h-full overflow-hidden">
              <NoteContextSidebar noteId={focusedNoteId} currentUserId={currentUserId} className="border-l-0" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
