import { useEffect, useState } from "react";
import { MessageSquare, CheckSquare, Tag, RefreshCw, HelpCircle, Send, Trash2, Check } from "lucide-react";
import type { Comment } from "../../types";
import * as api from "../../api";
import { CommentTypeBadge } from "../common/Badge";
import { Modal } from "../common/Modal";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  comment:  <MessageSquare size={12} />,
  todo:     <CheckSquare  size={12} />,
  tag:      <Tag          size={12} />,
  update:   <RefreshCw   size={12} />,
  question: <HelpCircle  size={12} />,
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

interface Props {
  noteId: number;
  currentUserId: number;
}

export function CommentPanel({ noteId, currentUserId }: Props) {
  const [comments, setComments]     = useState<Comment[]>([]);
  const [text, setText]             = useState("");
  const [type, setType]             = useState<string>("comment");
  const [loading, setLoading]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<Comment | null>(null);
  const [editText, setEditText] = useState("");
  const [editType, setEditType] = useState("comment");

  useEffect(() => {
    setLoading(true);
    api.listComments(noteId).then(setComments).finally(() => setLoading(false));
  }, [noteId]);

  async function submit() {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const c = await api.addComment({
        note_id: noteId, author_id: currentUserId, content: text.trim(), comment_type: type,
      });
      setComments((prev) => [...prev, c]);
      setText("");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: number) {
    await api.deleteComment(id);
    setComments((prev) => prev.filter((c) => c.id !== id));
  }

  async function resolve(id: number) {
    const updated = await api.resolveComment(id);
    setComments((prev) => prev.map((c) => (c.id === id ? updated : c)));
  }

  function openEdit(comment: Comment) {
    setEditing(comment);
    setEditText(comment.content);
    setEditType(comment.comment_type);
  }

  async function saveEdit() {
    if (!editing || !editText.trim()) return;
    const updated = await api.updateComment(editing.id, { content: editText.trim(), comment_type: editType });
    setComments((prev) => prev.map((c) => (c.id === editing.id ? updated : c)));
    setEditing(null);
  }

  return (
    <div className="h-full border-l border-border bg-bg-surface flex flex-col">
      {/* Section header */}
      <div className="flex items-center gap-2 px-5 py-2.5 border-b border-border shrink-0">
        <MessageSquare size={13} className="text-text-muted" />
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          Kommentare & Feedback
        </span>
        {comments.length > 0 && (
          <span className="text-[10px] bg-bg-active text-text-muted px-1.5 py-0.5 rounded-full">
            {comments.length}
          </span>
        )}
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto px-5 py-2 space-y-2">
        {loading && <p className="text-xs text-text-muted py-2">Laden…</p>}
        {!loading && comments.length === 0 && (
          <p className="text-xs text-text-muted py-4 text-center">Noch keine Kommentare</p>
        )}
        {comments.map((c) => (
          <div
            key={c.id}
            className={`flex gap-2.5 group ${c.is_resolved ? "opacity-50" : ""}`}
          >
            <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center
                            text-[10px] font-semibold text-accent shrink-0 mt-0.5">
              {c.author_name.charAt(0).toUpperCase()}
            </div>
            <button className="flex-1 min-w-0 text-left" onClick={() => openEdit(c)}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-xs font-medium text-text-secondary">{c.author_name}</span>
                <CommentTypeBadge type={c.comment_type} />
                {c.is_resolved && (
                  <span className="text-[10px] text-emerald-400">✓ erledigt</span>
                )}
                <span className="text-[10px] text-text-muted ml-auto">{fmtDate(c.created_at)}</span>
              </div>
              <p className="text-xs text-text-primary leading-relaxed">{c.content}</p>
            </button>
            {/* Actions */}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              {(c.comment_type === "todo" || c.comment_type === "question") && !c.is_resolved && (
                <button onClick={() => resolve(c.id)} title="Als erledigt markieren"
                  className="w-6 h-6 flex items-center justify-center rounded text-emerald-400 hover:bg-emerald-900/30">
                  <Check size={11} />
                </button>
              )}
              {c.author_id === currentUserId && (
                <button onClick={() => remove(c.id)} title="Löschen"
                  className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-red-400 hover:bg-red-900/20">
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input area */}
      <div className="px-5 py-3 border-t border-border shrink-0">
        <div className="flex gap-2 items-end">
          {/* Type selector */}
          <div className="flex gap-1 shrink-0">
            {(["comment", "todo", "question", "update", "tag"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                title={t}
                className={`w-7 h-7 flex items-center justify-center rounded transition-colors
                  ${type === t
                    ? "bg-accent/20 text-accent"
                    : "text-text-muted hover:bg-bg-hover hover:text-text-secondary"
                  }`}
              >
                {TYPE_ICONS[t]}
              </button>
            ))}
          </div>
          <textarea
            className="input flex-1 resize-none text-xs py-1.5"
            rows={2}
            placeholder={`${type === "todo" ? "Aufgabe" : type === "question" ? "Frage" : "Kommentar"} hinzufügen…`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) submit(); }}
          />
          <button
            onClick={submit}
            disabled={submitting || !text.trim()}
            title="Kommentar senden"
            className="btn-sm btn-primary shrink-0"
          >
            <Send size={12} />
          </button>
        </div>
        <p className="text-[10px] text-text-muted mt-1">Strg+Enter zum Senden</p>
      </div>

      {editing && (
        <Modal title="Eintrag bearbeiten" onClose={() => setEditing(null)} width="max-w-xl">
          <div className="p-4 space-y-3">
            <select title="Eintragstyp" className="input-sm" value={editType} onChange={(e) => setEditType(e.target.value)}>
              <option value="comment">Kommentar</option>
              <option value="todo">Aufgabe</option>
              <option value="question">Frage</option>
              <option value="update">Update</option>
              <option value="tag">Hinweis</option>
            </select>
            <textarea title="Eintragstext" className="input resize-none" rows={5} value={editText} onChange={(e) => setEditText(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 px-4 py-3 border-t border-border bg-bg-surface rounded-b-xl">
            <button className="btn-sm btn-ghost" onClick={() => setEditing(null)}>Abbrechen</button>
            <button className="btn-sm btn-primary" onClick={saveEdit}>Speichern</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
