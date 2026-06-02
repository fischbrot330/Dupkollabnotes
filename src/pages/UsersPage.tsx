import { useEffect, useState } from "react";
import { UserPlus, Pencil, ShieldCheck, Shield } from "lucide-react";
import type { CreateUserInput, UpdateUserInput, User } from "../types";
import * as api from "../api";
import { useAppStore } from "../store/useAppStore";
import { Modal } from "../components/common/Modal";

const ROLES = ["admin", "manager", "editor", "viewer"];
const ROLE_COLORS: Record<string, string> = {
  admin: "text-red-400", manager: "text-orange-400",
  editor: "text-blue-400", viewer: "text-text-muted",
};

export function UsersPage() {
  const currentUser = useAppStore((s) => s.currentUser);
  const login = useAppStore((s) => s.login);
  const [users, setUsers]     = useState<User[]>([]);
  const [showModal, setShowModal] = useState<"create" | "edit" | null>(null);
  const [editUser, setEditUser]   = useState<User | null>(null);

  // form
  const [fUsername, setFUsername]   = useState("");
  const [fFullName, setFFullName]   = useState("");
  const [fEmail, setFEmail]         = useState("");
  const [fRole, setFRole]           = useState("viewer");
  const [fPassword, setFPassword]   = useState("");
  const [fActive, setFActive]       = useState(true);
  const [fManUsers, setFManUsers]   = useState(false);
  const [fManProjs, setFManProjs]   = useState(false);
  const [fManTpls, setFManTpls]     = useState(false);
  const [fAiFunctions, setFAiFunctions] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const canManage = currentUser?.can_manage_users || currentUser?.role === "admin";
  const isAdmin = currentUser?.role === "admin";

  useEffect(() => { api.listUsers().then(setUsers); }, []);

  function openCreate() {
    setFUsername(""); setFFullName(""); setFEmail(""); setFRole("viewer");
    setFPassword(""); setFActive(true); setFManUsers(false); setFManProjs(false); setFManTpls(false); setFAiFunctions(false);
    setEditUser(null); setError(null); setShowModal("create");
  }

  function openEdit(u: User) {
    setFUsername(u.username); setFFullName(u.full_name); setFEmail(u.email ?? "");
    setFRole(u.role); setFPassword(""); setFActive(u.is_active);
    setFManUsers(u.can_manage_users); setFManProjs(u.can_manage_projects); setFManTpls(u.can_manage_templates);
    setFAiFunctions(Boolean(u.can_use_ai_functions));
    setEditUser(u); setError(null); setShowModal("edit");
  }

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      if (showModal === "create") {
        const d: CreateUserInput = {
          username: fUsername.trim(), full_name: fFullName.trim(), email: fEmail || null,
          role: fRole, password: fPassword,
          can_manage_users: fManUsers, can_manage_projects: fManProjs, can_manage_templates: fManTpls,
          can_use_ai_functions: isAdmin ? fAiFunctions : undefined,
          acting_user_id: currentUser?.id ?? null,
        };
        await api.createUser(d);
      } else if (showModal === "edit" && editUser) {
        const d: UpdateUserInput = {
          full_name: fFullName.trim(), email: fEmail || null, role: fRole, is_active: fActive,
          can_manage_users: fManUsers, can_manage_projects: fManProjs, can_manage_templates: fManTpls,
          can_use_ai_functions: isAdmin ? fAiFunctions : undefined,
          acting_user_id: currentUser?.id ?? null,
          password: fPassword || null,
        };
        const updatedUser = await api.updateUser(editUser.id, d);
        if (currentUser && updatedUser.id === currentUser.id) {
          login(updatedUser);
        }
      }
      const refreshed = await api.listUsers();
      setUsers(refreshed);
      setShowModal(null);
    } catch (e) { setError(String(e)); } finally { setSaving(false); }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-text-primary">Team-Mitglieder</h2>
          {canManage && (
            <button onClick={openCreate} className="btn-sm btn-primary">
              <UserPlus size={13} /> Nutzer anlegen
            </button>
          )}
        </div>

        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-2.5 text-xs font-medium text-text-muted">Name</th>
                <th className="px-4 py-2.5 text-xs font-medium text-text-muted">Username</th>
                <th className="px-4 py-2.5 text-xs font-medium text-text-muted">E-Mail</th>
                <th className="px-4 py-2.5 text-xs font-medium text-text-muted">Rolle</th>
                <th className="px-4 py-2.5 text-xs font-medium text-text-muted">Status</th>
                <th className="px-4 py-2.5 text-xs font-medium text-text-muted">Rechte</th>
                {canManage && <th className="px-4 py-2.5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-bg-hover transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center
                                      text-xs font-semibold text-accent shrink-0">
                        {u.full_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-text-primary font-medium">{u.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary font-mono text-xs">{u.username}</td>
                  <td className="px-4 py-3 text-text-muted text-xs">{u.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${ROLE_COLORS[u.role] ?? "text-text-muted"}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded
                      ${u.is_active ? "bg-emerald-900/30 text-emerald-400" : "bg-bg-active text-text-muted"}`}>
                      {u.is_active ? "Aktiv" : "Inaktiv"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {u.can_manage_users    && <ShieldCheck size={13} className="text-accent" aria-label="Nutzerverwaltung" />}
                      {u.can_manage_projects && <ShieldCheck size={13} className="text-cyan-400" aria-label="Projektverwaltung" />}
                      {u.can_manage_templates && <Shield size={13} className="text-yellow-400" aria-label="Vorlagenverwaltung" />}
                      {isAdmin && u.can_use_ai_functions && <Shield size={13} className="text-violet-400" aria-label="AI Funktionen" />}
                    </div>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(u)} className="btn-sm btn-ghost">
                        <Pencil size={12} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <Modal title={showModal === "create" ? "Neuer Nutzer" : "Nutzer bearbeiten"} onClose={() => setShowModal(null)}>
          <div className="p-5 flex flex-col gap-3">
            {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-900/30 rounded px-3 py-2">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-text-muted block mb-1">Vollständiger Name *</label>
                <input className="input" value={fFullName} onChange={(e) => setFFullName(e.target.value)} placeholder="Max Mustermann" />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Username *</label>
                <input className="input font-mono" value={fUsername} onChange={(e) => setFUsername(e.target.value)} placeholder="m.mustermann" disabled={showModal === "edit"} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-text-muted block mb-1">E-Mail</label>
                <input className="input" type="email" value={fEmail} onChange={(e) => setFEmail(e.target.value)} placeholder="email@example.com" />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Rolle</label>
                <select className="input" value={fRole} onChange={(e) => setFRole(e.target.value)}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">
                Passwort {showModal === "edit" ? "(leer lassen = unverändert)" : "*"}
              </label>
              <input className="input" type="password" value={fPassword} onChange={(e) => setFPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="flex flex-wrap gap-3">
              {showModal === "edit" && (
                <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
                  <input type="checkbox" checked={fActive} onChange={(e) => setFActive(e.target.checked)} className="accent-accent" />
                  Aktiv
                </label>
              )}
              <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
                <input type="checkbox" checked={fManUsers} onChange={(e) => setFManUsers(e.target.checked)} className="accent-accent" />
                Nutzerverwaltung
              </label>
              <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
                <input type="checkbox" checked={fManProjs} onChange={(e) => setFManProjs(e.target.checked)} className="accent-accent" />
                Projektverwaltung
              </label>
              <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
                <input type="checkbox" checked={fManTpls} onChange={(e) => setFManTpls(e.target.checked)} className="accent-accent" />
                Vorlagen
              </label>
              {isAdmin && (
                <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
                  <input type="checkbox" checked={fAiFunctions} onChange={(e) => setFAiFunctions(e.target.checked)} className="accent-accent" />
                  AI Funktionen
                </label>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-border bg-bg-surface rounded-b-xl">
            <button onClick={() => setShowModal(null)} className="btn-sm btn-ghost">Abbrechen</button>
            <button onClick={handleSave} disabled={saving} className="btn-sm btn-primary">
              {saving ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
