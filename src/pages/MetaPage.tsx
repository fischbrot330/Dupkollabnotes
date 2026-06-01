import { useEffect, useState } from "react";
import type { Category, Tag, Template } from "../types";
import * as api from "../api";

const LOCKED = new Set(["Aufgabe", "Update", "Misc", "Kommentar", "Feedback", "Meeting Notes"]);

export function MetaPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [newCategory, setNewCategory] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateBody, setNewTemplateBody] = useState("");
  const [newTemplateCategoryId, setNewTemplateCategoryId] = useState<number | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [editTemplateName, setEditTemplateName] = useState("");
  const [editTemplateBody, setEditTemplateBody] = useState("");
  const [editTemplateCategoryId, setEditTemplateCategoryId] = useState<number | null>(null);

  async function load() {
    const [c, t, tpl] = await Promise.all([api.listCategories(), api.listTags(), api.listTemplates()]);
    setCategories(c);
    setTags(t);
    setTemplates(tpl);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const tpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tpl) return;
    setEditTemplateName(tpl.name);
    setEditTemplateBody(tpl.content);
    setEditTemplateCategoryId(tpl.category_id ?? null);
  }, [selectedTemplateId, templates]);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Kategorien</h3>
          <div className="flex gap-2">
            <input className="input-sm flex-1" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Neue Kategorie" />
            <button className="btn-sm btn-primary" onClick={async () => { if (!newCategory.trim()) return; await api.createCategory({ name: newCategory.trim(), color: null }); setNewCategory(""); load(); }}>+</button>
          </div>
          <div className="space-y-1">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-xs border border-border rounded px-2 py-1.5">
                <span>{c.name}</span>
                <button disabled={LOCKED.has(c.name)} className="btn-sm btn-ghost" onClick={async () => { await api.deleteCategory(c.id); load(); }}>Löschen</button>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Tags</h3>
          <div className="flex gap-2">
            <input className="input-sm flex-1" value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Neuer Tag" />
            <button className="btn-sm btn-primary" onClick={async () => { if (!newTag.trim()) return; await api.createTag({ name: newTag.trim(), color: null }); setNewTag(""); load(); }}>+</button>
          </div>
          <div className="space-y-1">
            {tags.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-xs border border-border rounded px-2 py-1.5">
                <span>{t.name}</span>
                <button className="btn-sm btn-ghost" onClick={async () => { await api.deleteTag(t.id); load(); }}>Löschen</button>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Vorlagen</h3>
          <input className="input-sm" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} placeholder="Vorlagenname" />
          <select title="Kategoriezuweisung neue Vorlage" className="input-sm" value={newTemplateCategoryId ?? ""} onChange={(e) => setNewTemplateCategoryId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Keine Kategoriebindung</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <textarea className="input resize-none" rows={4} value={newTemplateBody} onChange={(e) => setNewTemplateBody(e.target.value)} placeholder="Markdown-Vorlage" />
          <button className="btn-sm btn-primary" onClick={async () => { if (!newTemplateName.trim()) return; await api.createTemplate({ name: newTemplateName.trim(), content: newTemplateBody, category_id: newTemplateCategoryId }); setNewTemplateName(""); setNewTemplateBody(""); setNewTemplateCategoryId(null); load(); }}>Vorlage speichern</button>
          <div className="space-y-1">
            {templates.map((tpl) => (
              <div key={tpl.id} className="flex items-center justify-between text-xs border border-border rounded px-2 py-1.5">
                <button className="text-left flex-1" onClick={() => setSelectedTemplateId(tpl.id)}>
                  <span>{tpl.name}</span>
                  {tpl.category_name && <span className="text-text-muted"> · {tpl.category_name}</span>}
                </button>
                <button className="btn-sm btn-ghost" onClick={async () => { await api.deleteTemplate(tpl.id); if (selectedTemplateId === tpl.id) setSelectedTemplateId(null); load(); }}>Löschen</button>
              </div>
            ))}
          </div>

          {selectedTemplateId && (
            <div className="border border-border rounded p-2 space-y-2 mt-2">
              <p className="text-xs text-text-muted">Vorlage bearbeiten</p>
              <input className="input-sm" value={editTemplateName} onChange={(e) => setEditTemplateName(e.target.value)} placeholder="Vorlagenname" />
              <select title="Kategoriezuweisung bearbeiten" className="input-sm" value={editTemplateCategoryId ?? ""} onChange={(e) => setEditTemplateCategoryId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Keine Kategoriebindung</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <textarea title="Vorlageninhalt" className="input resize-none" rows={5} value={editTemplateBody} onChange={(e) => setEditTemplateBody(e.target.value)} />
              <div className="flex justify-end gap-2">
                <button className="btn-sm btn-ghost" onClick={() => setSelectedTemplateId(null)}>Schließen</button>
                <button
                  className="btn-sm btn-primary"
                  onClick={async () => {
                    await api.updateTemplate(selectedTemplateId, {
                      name: editTemplateName.trim(),
                      content: editTemplateBody,
                      category_id: editTemplateCategoryId,
                    });
                    load();
                  }}
                >
                  Speichern
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
