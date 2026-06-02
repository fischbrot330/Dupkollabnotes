import { useEffect, useState } from "react";
import * as api from "../api";
import type { AiPrompt } from "../types";
import { useAppStore } from "../store/useAppStore";

export function SettingsPage() {
  const currentUser = useAppStore((s) => s.currentUser);
  const canUseAi = Boolean(currentUser?.can_use_ai_functions);
  const [databasePath, setDatabasePath] = useState("");
  const [theme, setTheme] = useState("midnight");
  const [resolvedPath, setResolvedPath] = useState("");
  const [llmModelPath, setLlmModelPath] = useState("");
  const [resolvedLlmModelPath, setResolvedLlmModelPath] = useState("");
  const [aiPrompts, setAiPrompts] = useState<AiPrompt[]>([]);
  const [newPromptName, setNewPromptName] = useState("");
  const [newPromptContent, setNewPromptContent] = useState("");
  const [editingPromptId, setEditingPromptId] = useState<number | null>(null);
  const [editPromptName, setEditPromptName] = useState("");
  const [editPromptContent, setEditPromptContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadSettings() {
    const s = await api.getSettings();
    setDatabasePath(s.database_path);
    setTheme(s.theme);
    setResolvedPath(s.resolved_database_path);
    setLlmModelPath(s.llm_model_path ?? "");
    setResolvedLlmModelPath(s.resolved_llm_model_path ?? "");
  }

  async function loadAiPrompts() {
    if (!canUseAi || !currentUser) return;
    const prompts = await api.listAiPrompts(currentUser.id);
    setAiPrompts(prompts);
  }

  useEffect(() => {
    loadSettings();
    loadAiPrompts();
  }, [canUseAi, currentUser?.id]);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const result = await api.updateSettings({
        database_path: databasePath,
        theme,
        llm_model_path: canUseAi ? llmModelPath : "",
        acting_user_id: currentUser?.id ?? null,
      });
      setMessage(result.requires_restart ? "Gespeichert. Neustart der App erforderlich." : "Gespeichert.");
      await loadSettings();
    } catch (e) {
      setMessage(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function createPrompt() {
    if (!currentUser || !newPromptName.trim()) return;
    await api.createAiPrompt({
      user_id: currentUser.id,
      name: newPromptName.trim(),
      content: newPromptContent,
    });
    setNewPromptName("");
    setNewPromptContent("");
    await loadAiPrompts();
  }

  async function updatePrompt() {
    if (!currentUser || editingPromptId == null) return;
    await api.updateAiPrompt(editingPromptId, {
      user_id: currentUser.id,
      name: editPromptName.trim(),
      content: editPromptContent,
    });
    setEditingPromptId(null);
    await loadAiPrompts();
  }

  async function deletePrompt(promptId: number) {
    if (!currentUser) return;
    await api.deleteAiPrompt(promptId, currentUser.id);
    if (editingPromptId === promptId) setEditingPromptId(null);
    await loadAiPrompts();
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto card p-5 space-y-4">
        <h2 className="text-base font-semibold text-text-primary">Einstellungen</h2>
        {message && <p className="text-xs text-text-secondary">{message}</p>}
        <div>
          <label className="text-xs text-text-muted block mb-1">Datenbank-Pfad</label>
          <input className="input" value={databasePath} onChange={(e) => setDatabasePath(e.target.value)} />
          <p className="text-[11px] text-text-muted mt-1">Aktuell aufgelöst: {resolvedPath}</p>
        </div>
        <div>
          <label className="text-xs text-text-muted block mb-1">Theme</label>
          <select className="input" value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value="midnight">midnight</option>
            <option value="light">light</option>
          </select>
        </div>
        {canUseAi && (
          <>
            <div>
              <label className="text-xs text-text-muted block mb-1">Lokaler GGUF Modell-Pfad</label>
              <input className="input" value={llmModelPath} onChange={(e) => setLlmModelPath(e.target.value)} />
              {resolvedLlmModelPath && (
                <p className="text-[11px] text-text-muted mt-1">Aktuell aufgelöst: {resolvedLlmModelPath}</p>
              )}
            </div>
            <div className="pt-2 border-t border-border space-y-2">
              <h3 className="text-sm font-semibold text-text-primary">Meine AI-Prompts</h3>
              <div className="space-y-2">
                <input className="input" value={newPromptName} onChange={(e) => setNewPromptName(e.target.value)} placeholder="Promptname" />
                <textarea className="input resize-none" rows={4} value={newPromptContent} onChange={(e) => setNewPromptContent(e.target.value)} placeholder="Prompt-Inhalt" />
                <button onClick={createPrompt} className="btn-sm btn-primary">Prompt speichern</button>
              </div>
              <div className="space-y-2">
                {aiPrompts.map((prompt) => (
                  <div key={prompt.id} className="border border-border rounded p-2">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        className="text-left text-sm text-text-primary"
                        onClick={() => {
                          setEditingPromptId(prompt.id);
                          setEditPromptName(prompt.name);
                          setEditPromptContent(prompt.content);
                        }}
                      >
                        {prompt.name}
                      </button>
                      <button className="btn-sm btn-ghost" onClick={() => deletePrompt(prompt.id)}>Löschen</button>
                    </div>
                  </div>
                ))}
              </div>
              {editingPromptId != null && (
                <div className="border border-border rounded p-2 space-y-2">
                  <input className="input" value={editPromptName} onChange={(e) => setEditPromptName(e.target.value)} />
                  <textarea className="input resize-none" rows={5} value={editPromptContent} onChange={(e) => setEditPromptContent(e.target.value)} />
                  <div className="flex justify-end gap-2">
                    <button className="btn-sm btn-ghost" onClick={() => setEditingPromptId(null)}>Abbrechen</button>
                    <button className="btn-sm btn-primary" onClick={updatePrompt}>Speichern</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
        <div className="flex justify-end">
          <button onClick={save} disabled={saving} className="btn-sm btn-primary">{saving ? "Speichern…" : "Speichern"}</button>
        </div>
      </div>
    </div>
  );
}
