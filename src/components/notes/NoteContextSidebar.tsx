import { useEffect, useMemo, useState } from "react";
import { CheckSquare, MessageSquare, Send } from "lucide-react";
import type { Comment } from "../../types";
import * as api from "../../api";
import { CommentTypeBadge } from "../common/Badge";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  noteId: number;
  currentUserId: number;
  className?: string;
}

export function NoteContextSidebar({ noteId, currentUserId, className = "" }: Props) {
  const [entries, setEntries] = useState<Comment[]>([]);
  const [taskText, setTaskText] = useState("");
  const [messageText, setMessageText] = useState("");
  const [messageType, setMessageType] = useState<"comment" | "feedback" | "question" | "update">("comment");
  const [submittingTask, setSubmittingTask] = useState(false);
  const [submittingMessage, setSubmittingMessage] = useState(false);

  useEffect(() => {
    api.listComments(noteId).then(setEntries);
  }, [noteId]);

  const tasks = useMemo(
    () => entries.filter((x) => x.comment_type === "todo").sort((a, b) => Number(a.is_resolved) - Number(b.is_resolved)),
    [entries]
  );

  const messages = useMemo(
    () => entries.filter((x) => x.comment_type !== "todo"),
    [entries]
  );

  async function addTask() {
    if (!taskText.trim()) return;
    setSubmittingTask(true);
    try {
      const created = await api.addComment({
        note_id: noteId,
        author_id: currentUserId,
        content: taskText.trim(),
        comment_type: "todo",
      });
      setEntries((prev) => [...prev, created]);
      setTaskText("");
    } finally {
      setSubmittingTask(false);
    }
  }

  async function addMessage() {
    if (!messageText.trim()) return;
    setSubmittingMessage(true);
    try {
      const created = await api.addComment({
        note_id: noteId,
        author_id: currentUserId,
        content: messageText.trim(),
        comment_type: messageType,
      });
      setEntries((prev) => [...prev, created]);
      setMessageText("");
    } finally {
      setSubmittingMessage(false);
    }
  }

  async function toggleTask(task: Comment) {
    if (task.is_resolved) return;
    const updated = await api.resolveComment(task.id);
    setEntries((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  }

  return (
    <aside className={`h-full border-l border-border bg-bg-surface flex flex-col ${className}`}>
      <div className="px-4 py-2 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Kontext</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <section>
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare size={13} className="text-text-muted" />
            <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Kommentare & Feedback</h4>
          </div>
          <div className="space-y-2">
            {messages.length === 0 && <p className="text-[11px] text-text-muted">Noch keine Einträge</p>}
            {messages.map((entry) => (
              <article key={entry.id} className={`card p-2 ${entry.is_resolved ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-text-secondary font-medium">{entry.author_name}</span>
                  <CommentTypeBadge type={entry.comment_type} />
                  <span className="text-[10px] text-text-muted ml-auto">{fmtDate(entry.created_at)}</span>
                </div>
                <p className="text-xs text-text-primary mt-1 leading-relaxed">{entry.content}</p>
              </article>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5">
            <select
              aria-label="Nachrichtentyp"
              className="input-sm w-32"
              value={messageType}
              onChange={(e) => setMessageType(e.target.value as "comment" | "feedback" | "question" | "update")}
            >
              <option value="comment">Kommentar</option>
              <option value="feedback">Feedback</option>
              <option value="question">Frage</option>
              <option value="update">Update</option>
            </select>
            <input
              aria-label="Kommentar oder Feedback"
              className="input-sm flex-1"
              placeholder="Neuer Eintrag..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
            />
            <button className="btn-sm btn-primary" disabled={submittingMessage || !messageText.trim()} onClick={addMessage}>
              <Send size={11} />
            </button>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-2">
            <CheckSquare size={13} className="text-text-muted" />
            <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Aufgaben</h4>
          </div>
          <div className="space-y-1.5">
            {tasks.length === 0 && <p className="text-[11px] text-text-muted">Noch keine Aufgaben</p>}
            {tasks.map((task) => (
              <button
                key={task.id}
                className={`w-full text-left card p-2 border ${task.is_resolved ? "opacity-60" : "hover:border-accent/40"}`}
                onClick={() => toggleTask(task)}
                title={task.is_resolved ? "Bereits erledigt" : "Als erledigt markieren"}
              >
                <div className="flex items-start gap-2">
                  <input className="mt-1 accent-accent" type="checkbox" checked={task.is_resolved} readOnly />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-text-primary leading-relaxed">{task.content}</p>
                    <p className="text-[10px] text-text-muted mt-1">{task.author_name} · {fmtDate(task.created_at)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5">
            <input
              aria-label="Neue Aufgabe"
              className="input-sm flex-1"
              placeholder="Neue Aufgabe..."
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
            />
            <button className="btn-sm btn-primary" disabled={submittingTask || !taskText.trim()} onClick={addTask}>
              <Send size={11} />
            </button>
          </div>
        </section>
      </div>
    </aside>
  );
}
