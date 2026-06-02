import { useEffect, useState } from "react";
import MDEditor from "@uiw/react-md-editor";
import { Archive, Mail, Pencil, Trash2, Pin, FileText } from "lucide-react";
import type { AiPrompt, NoteDetail } from "../../types";
import { Badge } from "../common/Badge";
import * as api from "../../api";
import { Modal } from "../common/Modal";

function fmtDt(iso: string) {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

interface Props {
  note: NoteDetail | null;
  currentUserId: number | null;
  canUseAiFunctions?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAiApplyContent?: (noteId: number, content: string) => Promise<void>;
  onCompleteTask?: (noteId: number) => void;
  onOpenProject?: (projectId: number) => void;
  onArchiveToggle?: (noteId: number) => void;
}

export function NoteViewer({ note, currentUserId, canUseAiFunctions = false, onEdit, onDelete, onAiApplyContent, onCompleteTask, onOpenProject, onArchiveToggle }: Props) {
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompts, setAiPrompts] = useState<AiPrompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<number | null>(null);
  const [previewContent, setPreviewContent] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!showAiModal || !currentUserId) return;
    api.listAiPrompts(currentUserId).then(setAiPrompts).catch(() => setAiPrompts([]));
  }, [showAiModal, currentUserId]);

  if (!note) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-muted select-none">
        <FileText size={44} className="mb-3 opacity-20" />
        <p className="text-sm">Notiz auswählen</p>
        <p className="text-xs mt-1 opacity-60">Klicke auf eine Notiz in der Liste</p>
      </div>
    );
  }

  const isOwner = note.author_id === currentUserId;

  async function openInOutlook() {
    try {
      await api.openOutlookDraft(note?.title || "Notiz", note?.content || "");
    } catch (e) {
      window.alert(`Outlook-Mail konnte nicht geöffnet werden: ${String(e)}`);
    }
  }

  async function generateAiPreview() {
    if (!currentUserId || !selectedPromptId || !note) return;
    setAiLoading(true);
    try {
      const result = await api.processNoteWithAi({
        user_id: currentUserId,
        prompt_id: selectedPromptId,
        content: note.content,
      });
      setPreviewContent(result.processed_content);
    } catch (e) {
      window.alert(String(e));
    } finally {
      setAiLoading(false);
    }
  }

  async function applyAiContent() {
    if (!note || !previewContent.trim() || !onAiApplyContent) return;
    await onAiApplyContent(note.id, previewContent);
    setShowAiModal(false);
    setPreviewContent("");
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Note header */}
      <div className="px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {note.is_pinned && <Pin size={12} className="text-accent shrink-0" />}
              <h2 className="text-lg font-semibold text-text-primary truncate">{note.title}</h2>
            </div>

            {/* Meta — subtle */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {note.author_name && (
                <span className="text-xs text-text-muted">von {note.author_name}</span>
              )}
              {note.category_name && (
                <Badge color={null} variant="default">{note.category_name}</Badge>
              )}
              {note.project_name && (
                <button
                  className="text-xs text-accent hover:text-accent-hover"
                  onClick={() => note.project_id && onOpenProject?.(note.project_id)}
                >
                  {note.project_name}
                </button>
              )}
              {note.due_date && <span className="text-xs text-text-muted">• Due: {note.due_date.slice(0, 10)}</span>}
              <span className="text-xs text-text-muted">• {fmtDt(note.updated_at)}</span>
            </div>

            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {(note.open_todos_count ?? 0) > 0 && <Badge variant="todo">{note.open_todos_count} offen</Badge>}
              {(note.done_todos_count ?? 0) > 0 && <Badge variant="todo">{note.done_todos_count} erledigt</Badge>}
              {(note.new_comments_count ?? 0) > 0 && <Badge variant="comment">{note.new_comments_count} Kommentare</Badge>}
              {(note.feedback_count ?? 0) > 0 && <Badge variant="feedback">{note.feedback_count} Feedback</Badge>}
            </div>

            {note.tags.length > 0 && (
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {note.tags.map((t) => <Badge key={t.id} color={t.color}>{t.name}</Badge>)}
              </div>
            )}
          </div>

          {/* Action buttons — only for owner */}
          <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
            {canUseAiFunctions && (
              <button onClick={() => setShowAiModal(true)} className="btn-sm btn-ghost" title="Notiz mit AI verarbeiten">
                AI
              </button>
            )}
            {isOwner && (
              <>
                {note.note_type === "todo" && !note.is_archived && !note.completed_at && (
                  <button onClick={() => onCompleteTask?.(note.id)} className="btn-sm btn-primary" title="Aufgabe abschließen">
                    Erledigt
                  </button>
                )}
                <button
                  onClick={() => onArchiveToggle?.(note.id)}
                  className={`btn-sm ${note.is_user_archived ? "btn-primary" : "btn-ghost"}`}
                  title={note.is_user_archived ? "Aus Archiv holen" : "Archivieren"}
                >
                  <Archive size={13} /> {note.is_user_archived ? "Entarchivieren" : "Archivieren"}
                </button>
                <button onClick={openInOutlook} className="btn-sm btn-ghost" title="Als Outlook-Mail öffnen">
                  <Mail size={13} /> Mail
                </button>
                <button onClick={onEdit} className="btn-sm btn-primary">
                  <Pencil size={13} /> Bearbeiten
                </button>
                <button
                  onClick={onDelete}
                  className="btn-sm btn-danger"
                  title="Notiz löschen"
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Rendered markdown — the centrepiece */}
      <div
        className="flex-1 overflow-y-auto px-6 py-5"
        data-color-mode="dark"
      >
        <MDEditor.Markdown
          source={note.content || "*Kein Inhalt*"}
          style={{ background: "transparent" }}
        />
      </div>
      {showAiModal && (
        <Modal title="Notiz mit AI verarbeiten" onClose={() => setShowAiModal(false)} width="max-w-3xl">
          <div className="p-5 space-y-3">
            <select
              className="input"
              value={selectedPromptId ?? ""}
              onChange={(e) => setSelectedPromptId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Prompt wählen…</option>
              {aiPrompts.map((prompt) => <option key={prompt.id} value={prompt.id}>{prompt.name}</option>)}
            </select>
            <button onClick={generateAiPreview} disabled={aiLoading || !selectedPromptId} className="btn-sm btn-primary">
              {aiLoading ? "Erzeuge Vorschau…" : "Vorschau erzeugen"}
            </button>
            <div>
              <label className="text-xs text-text-muted block mb-1">Vorschau</label>
              <textarea className="input resize-none" rows={12} value={previewContent} onChange={(e) => setPreviewContent(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-border bg-bg-surface rounded-b-xl">
            <button onClick={() => setShowAiModal(false)} className="btn-sm btn-ghost">Abbrechen</button>
            <button onClick={applyAiContent} disabled={!previewContent.trim()} className="btn-sm btn-primary">In Notiz übernehmen</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
