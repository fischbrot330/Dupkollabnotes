// All shared TypeScript types matching Rust models

export interface User {
  id: number;
  username: string;
  full_name: string;
  email: string | null;
  role: "admin" | "manager" | "editor" | "viewer";
  can_manage_users: boolean;
  can_manage_projects: boolean;
  can_manage_templates: boolean;
  can_use_ai_functions: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  color: string | null;
}

export interface Tag {
  id: number;
  name: string;
  color: string | null;
}

export interface NoteSummary {
  id: number;
  title: string;
  content?: string;
  author_id: number | null;
  author_name: string | null;
  category_id: number | null;
  category_name: string | null;
  category_color?: string | null;
  project_id: number | null;
  project_name: string | null;
  note_type: string;
  visibility: string;
  is_pinned: boolean;
  parent_note_id?: number | null;
  assigned_user_id?: number | null;
  assigned_user_name?: string | null;
  open_todos_count?: number;
  done_todos_count?: number;
  new_comments_count?: number;
  feedback_count?: number;
  questions_count?: number;
  updates_count?: number;
  milestone_status?: "open" | "completed";
  is_milestone?: boolean;
  is_user_archived?: boolean;
  is_archived?: boolean;
  milestone_date?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  tags: Tag[];
  created_at?: string;
  updated_at: string;
}

export interface NoteDetail extends NoteSummary {
  content: string;
  created_at: string;
}

export interface Comment {
  id: number;
  note_id: number;
  author_id: number;
  author_name: string;
  content: string;
  comment_type: "comment" | "tag" | "todo" | "update" | "question" | "feedback";
  is_resolved: boolean;
  created_at: string;
}

export interface ProjectSummary {
  id: number;
  name: string;
  owner_id: number | null;
  owner_name: string | null;
  status: "active" | "completed" | "archived";
  milestone_date: string | null;
  tags: Tag[];
  todo_count: number;
  done_count: number;
  open_todos_count?: number;
  new_comments_count?: number;
  questions_count?: number;
  updates_count?: number;
  open_milestones_count?: number;
  completed_milestones_count?: number;
  is_user_archived?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectDetail {
  id: number;
  name: string;
  description: string | null;
  owner_id: number | null;
  owner_name: string | null;
  status: "active" | "completed" | "archived";
  milestone_date: string | null;
  tags: Tag[];
  todos: TodoItem[];
  updates: UpdateItem[];
  milestones?: UpdateItem[];
  created_at: string;
  updated_at: string;
}

export interface TodoItem {
  id: number;
  project_id: number;
  title: string;
  content: string;
  is_done: boolean;
  due_date: string | null;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  created_at: string;
  completed_at?: string | null;
}

export interface UpdateItem {
  id: number;
  project_id: number;
  title: string;
  content: string;
  author_id: number | null;
  author_name: string | null;
  category_id?: number | null;
  category_name?: string | null;
  note_type?: string;
  visibility?: "team" | "private";
  assigned_user_id?: number | null;
  assigned_user_name?: string | null;
  open_todos_count?: number;
  done_todos_count?: number;
  new_comments_count?: number;
  feedback_count?: number;
  questions_count?: number;
  updates_count?: number;
  tags?: Tag[];
  is_milestone?: boolean;
  is_user_archived?: boolean;
  is_archived?: boolean;
  milestone_date?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Template {
  id: number;
  name: string;
  content: string;
  category_id: number | null;
  category_name: string | null;
  created_at: string;
}

export interface DashboardData {
  total_notes: number;
  total_projects: number;
  pending_todos: number;
  completed_todos?: number;
  total_milestones?: number;
  completed_milestones?: number;
  active_users: number;
  recent_notes: NoteSummary[];
  recent_projects: ProjectSummary[];
  upcoming_milestones?: NoteSummary[];
  upcoming_tasks?: NoteSummary[];
  notes_with_open_todos?: { note: NoteSummary; open_todos: number }[];
  projects_with_open_todos?: { project: ProjectSummary; open_todos: number }[];
}

export interface MilestoneFilter {
  period: "weekly" | "monthly" | "quarterly" | "custom";
  start_date?: string | null;
  end_date?: string | null;
  viewer_id?: number | null;
}

export interface MilestoneAllFilter {
  search?: string | null;
  status: "all" | "open" | "completed";
  project_id?: number | null;
  author_id?: number | null;
  has_date: "all" | "yes" | "no";
  period?: "all" | "weekly" | "monthly" | "quarterly" | "custom";
  start_date?: string | null;
  end_date?: string | null;
  viewer_id?: number | null;
}

export interface NoteFilter {
  search: string | null;
  category_id: number | null;
  project_id: number | null;
  author_id: number | null;
  viewer_id?: number | null;
  note_type: string | null;
  tag_id: number | null;
  period?: "weekly" | "monthly" | "quarterly" | "custom";
  start_date?: string | null;
  end_date?: string | null;  include_archived?: boolean;
}

export interface ProjectListFilter {
  search?: string | null;
  status?: string | null;
  owner_id?: number | null;
  include_archived?: boolean;}

export interface AdvancedSearchFilter {
  query: string;
  exact_match: boolean;
  category_ids?: number[];
  tag_ids?: number[];
  author_ids?: number[];
  project_ids?: number[];
  period: "weekly" | "monthly" | "quarterly" | "custom" | "all";
  start_date?: string | null;
  end_date?: string | null;
  viewer_id?: number | null;
  limit?: number;
}

export interface SearchNoteResult {
  note: NoteSummary;
  snippet: string;
}

export interface SearchProjectResult {
  project: ProjectSummary;
  snippet: string;
}

export interface AdvancedSearchResult {
  notes: SearchNoteResult[];
  projects: SearchProjectResult[];
}

export interface ProjectFilter {
  search: string | null;
  status: string | null;
  owner_id: number | null;
}

// Form inputs
export interface CreateNoteInput {
  title: string;
  content: string;
  author_id: number | null;
  category_id: number | null;
  project_id: number | null;
  parent_note_id?: number | null;
  assigned_user_id?: number | null;
  note_type?: string;
  visibility?: "team" | "private";
  is_pinned?: boolean;
  is_milestone?: boolean;
  milestone_date?: string | null;
  due_date?: string | null;
  tag_ids?: number[];
  tags?: string[];
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
  category_id?: number | null;
  project_id?: number | null;
  parent_note_id?: number | null;
  assigned_user_id?: number | null;
  note_type?: string;
  visibility?: "team" | "private";
  is_pinned?: boolean;
  is_milestone?: boolean;
  is_archived?: boolean;
  completed_at?: string | null;
  milestone_date?: string | null;
  due_date?: string | null;
  tag_ids?: number[];
  tags?: string[];
}

export interface CreateProjectInput {
  name: string;
  description: string | null;
  owner_id: number | null;
  status: string;
  milestone_date: string | null;
  tags: string[];
}

export interface CreateUserInput {
  username: string;
  full_name: string;
  email: string | null;
  role: string;
  password: string;
  can_manage_users: boolean;
  can_manage_projects: boolean;
  can_manage_templates: boolean;
  can_use_ai_functions?: boolean | null;
  acting_user_id?: number | null;
}

export interface UpdateUserInput {
  full_name: string;
  email: string | null;
  role: string;
  is_active: boolean;
  can_manage_users: boolean;
  can_manage_projects: boolean;
  can_manage_templates: boolean;
  can_use_ai_functions?: boolean | null;
  acting_user_id?: number | null;
  password: string | null;
}

export interface AppSettingsDto {
  database_path: string;
  resolved_database_path: string;
  theme: string;
  llm_model_path: string;
  resolved_llm_model_path: string;
  active_user_id: number | null;
}

export interface AiPrompt {
  id: number;
  user_id: number;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface AiProcessResult {
  processed_content: string;
}
