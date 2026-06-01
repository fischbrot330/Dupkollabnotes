// API-Client: kommuniziert per HTTP mit dem FastAPI-Backend (kein Tauri/Rust mehr)
import type {
  Category, Comment, CreateNoteInput, CreateProjectInput, CreateUserInput,
  DashboardData, MilestoneAllFilter, MilestoneFilter, NoteDetail, NoteFilter, NoteSummary, ProjectDetail,
  ProjectFilter, ProjectListFilter, ProjectSummary, Tag, Template, TodoItem, UpdateItem,
  UpdateNoteInput, UpdateUserInput, User, AppSettingsDto, AdvancedSearchFilter, AdvancedSearchResult,
} from "../types";

const BASE = import.meta.env.VITE_API_BASE ?? "";

async function api<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`API ${method} ${path} → ${res.status}: ${detail}`);
  }
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

// Auth
export const authenticate = (username: string, password: string) =>
  api<User>("POST", "/api/auth/login", { username, password });

export const changePassword = (userId: number, oldPassword: string, newPassword: string) =>
  api<void>("POST", "/api/auth/change-password", { user_id: userId, old_password: oldPassword, new_password: newPassword });

// Notes
export const listNotes = (filter: NoteFilter) =>
  api<NoteSummary[]>("POST", "/api/notes/list", filter);

export const getNote = (id: number, viewerId?: number | null) =>
  api<NoteDetail>("GET", `/api/notes/${id}${viewerId != null ? `?viewer_id=${viewerId}` : ""}`);

export const createNote = (data: CreateNoteInput) =>
  api<NoteDetail>("POST", "/api/notes", data);

export const updateNote = (id: number, data: UpdateNoteInput) =>
  api<NoteDetail>("PUT", `/api/notes/${id}`, data);

export const deleteNote = (id: number) =>
  api<void>("DELETE", `/api/notes/${id}`);

export const openOutlookDraft = (subject: string, body: string) =>
  api<{ ok: boolean }>("POST", "/api/outlook/draft", { subject, body });

// Comments
export const listComments = (noteId: number) =>
  api<Comment[]>("GET", `/api/notes/${noteId}/comments`);

export const addComment = (data: {
  note_id: number; author_id: number; content: string; comment_type: string;
}) => api<Comment>("POST", "/api/comments", data);

export const updateComment = (id: number, data: { content: string; comment_type: string }) =>
  api<Comment>("PUT", `/api/comments/${id}`, data);

export const deleteComment = (id: number) =>
  api<void>("DELETE", `/api/comments/${id}`);

export const resolveComment = (id: number) =>
  api<Comment>("POST", `/api/comments/${id}/resolve`);

// Projects
export const listProjects = (filter: ProjectListFilter) =>
  api<ProjectSummary[]>("POST", "/api/projects/list", filter);

export const getProject = (id: number, viewerId?: number | null, includeArchived?: boolean) => {
  const params = new URLSearchParams();
  if (viewerId != null) params.set("viewer_id", String(viewerId));
  if (includeArchived) params.set("include_archived", "true");
  const qs = params.toString();
  return api<ProjectDetail>("GET", `/api/projects/${id}${qs ? `?${qs}` : ""}`);
};

export const toggleNoteArchive = (id: number) =>
  api<NoteSummary>("POST", `/api/notes/${id}/archive-toggle`);

export const toggleProjectArchive = (id: number) =>
  api<ProjectSummary>("POST", `/api/projects/${id}/archive-toggle`);

export const createProject = (data: CreateProjectInput) =>
  api<ProjectDetail>("POST", "/api/projects", data);

export const updateProject = (id: number, data: Partial<CreateProjectInput>) =>
  api<ProjectDetail>("PUT", `/api/projects/${id}`, data);

export const createTodo = (data: {
  project_id: number; title: string; content: string; due_date: string | null; assigned_user_id: number | null;
}) => api<TodoItem>("POST", "/api/todos", data);

export const listTodoBoard = (filter: {
  search?: string | null;
  status: "all" | "open" | "done";
  category_id?: number | null;
  project_id?: number | null;
  viewer_id?: number | null;
}) => api<NoteSummary[]>("POST", "/api/todos/board", filter);

export const toggleTodo = (id: number) =>
  api<TodoItem>("POST", `/api/todos/${id}/toggle`);

export const completeTaskNote = (id: number, authorId: number | null) =>
  api<NoteDetail>("POST", `/api/tasks/${id}/complete`, { author_id: authorId });

export const createUpdateItem = (data: {
  project_id: number; content: string; author_id: number | null;
}) => api<UpdateItem>("POST", "/api/updates", data);

// Users
export const listUsers = () =>
  api<User[]>("GET", "/api/users");

export const createUser = (data: CreateUserInput) =>
  api<User>("POST", "/api/users", data);

export const updateUser = (id: number, data: UpdateUserInput) =>
  api<User>("PUT", `/api/users/${id}`, data);

// Categories & Tags
export const listCategories = () =>
  api<Category[]>("GET", "/api/categories");

export const createCategory = (data: { name: string; color: string | null }) =>
  api<Category>("POST", "/api/categories", data);

export const updateCategory = (id: number, data: { name: string; color: string | null }) =>
  api<Category>("PUT", `/api/categories/${id}`, data);

export const deleteCategory = (id: number) =>
  api<void>("DELETE", `/api/categories/${id}`);

export const listTags = () =>
  api<Tag[]>("GET", "/api/tags");

export const createTag = (data: { name: string; color: string | null }) =>
  api<Tag>("POST", "/api/tags", data);

export const updateTag = (id: number, data: { name: string; color: string | null }) =>
  api<Tag>("PUT", `/api/tags/${id}`, data);

export const deleteTag = (id: number) =>
  api<void>("DELETE", `/api/tags/${id}`);

// Templates
export const listTemplates = () =>
  api<Template[]>("GET", "/api/templates");

export const createTemplate = (data: { name: string; content: string; category_id: number | null }) =>
  api<Template>("POST", "/api/templates", data);

export const updateTemplate = (id: number, data: { name: string; content: string; category_id: number | null }) =>
  api<Template>("PUT", `/api/templates/${id}`, data);

export const deleteTemplate = (id: number) =>
  api<void>("DELETE", `/api/templates/${id}`);

// Settings
export const getSettings = () =>
  api<AppSettingsDto>("GET", "/api/settings");

export const updateSettings = (data: { database_path: string; theme: string }) =>
  api<{ ok: boolean; requires_restart: boolean }>("PUT", "/api/settings", data);

// Dashboard
export const dashboardSnapshot = (viewerId?: number | null) =>
  api<DashboardData>("GET", `/api/dashboard${viewerId != null ? `?viewer_id=${viewerId}` : ""}`);

export const listMilestones = (filter: MilestoneFilter) =>
  api<NoteSummary[]>("POST", "/api/milestones/list", filter);

export const listAllMilestones = (filter: MilestoneAllFilter) =>
  api<NoteSummary[]>("POST", "/api/milestones/all", filter);

export const advancedSearch = (filter: AdvancedSearchFilter) =>
  api<AdvancedSearchResult>("POST", "/api/search/advanced", filter);
