from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Iterable

import markdown as md
from bleach.sanitizer import Cleaner
from jinja2 import BaseLoader, Environment
from sqlalchemy import desc, func, or_, select
from sqlalchemy.orm import Session, selectinload

from .database import DatabaseManager, seed_defaults
from .models import Category, Note, Project, Tag, Template, TodoItem, UpdateItem, User
from .security import hash_password, verify_password


SANITIZER = Cleaner(
    tags=[
        "a",
        "abbr",
        "acronym",
        "b",
        "blockquote",
        "br",
        "code",
        "div",
        "em",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "hr",
        "i",
        "img",
        "li",
        "ol",
        "p",
        "pre",
        "span",
        "strong",
        "table",
        "tbody",
        "td",
        "th",
        "thead",
        "tr",
        "ul",
        "input",
        "label",
    ],
    attributes={"a": ["href", "title"], "img": ["src", "alt"], "input": ["type", "checked", "disabled"], "label": ["for"]},
)


@dataclass(slots=True)
class PeriodFilter:
    start: datetime
    end: datetime


class AppService:
    def __init__(self, database_manager: DatabaseManager):
        self.database_manager = database_manager
        self.database_manager.ensure_parent_directory()
        self.database_manager.create_schema()
        with self.database_manager.session() as session:
            seed_defaults(session)
            session.commit()

    def session(self) -> Session:
        return self.database_manager.session()

    def render_markdown(self, content: str) -> str:
        html = md.markdown(content or "", extensions=["extra", "tables", "fenced_code", "toc"])
        return SANITIZER.clean(html)

    def render_template(self, template_content: str, values: dict[str, str]) -> str:
        env = Environment(loader=BaseLoader(), autoescape=False)
        template = env.from_string(template_content or "")
        return template.render(**values)

    def list_users(self) -> list[User]:
        with self.session() as session:
            return list(session.scalars(select(User).order_by(User.username)))

    def authenticate(self, username: str, password: str) -> User | None:
        with self.session() as session:
            user = session.scalar(select(User).where(User.username == username, User.is_active.is_(True)))
            if user and verify_password(password, user.password_salt, user.password_hash):
                return user
            return None

    def upsert_user(
        self,
        user_id: int | None,
        *,
        username: str,
        full_name: str,
        role: str,
        is_active: bool,
        can_manage_projects: bool,
        can_manage_templates: bool,
        can_manage_users: bool,
        password: str | None = None,
    ) -> User:
        with self.session() as session:
            user = session.get(User, user_id) if user_id else User()
            user.username = username.strip()
            user.full_name = full_name.strip()
            user.role = role
            user.is_active = is_active
            user.can_manage_projects = can_manage_projects
            user.can_manage_templates = can_manage_templates
            user.can_manage_users = can_manage_users
            if password:
                user.password_salt, user.password_hash = hash_password(password)
            session.add(user)
            session.commit()
            return user

    def list_categories(self) -> list[Category]:
        with self.session() as session:
            return list(session.scalars(select(Category).order_by(Category.name)))

    def list_projects(self) -> list[Project]:
        with self.session() as session:
            stmt = select(Project).options(selectinload(Project.owner), selectinload(Project.tags), selectinload(Project.notes)).order_by(Project.updated_at.desc())
            return list(session.scalars(stmt))

    def list_templates(self) -> list[Template]:
        with self.session() as session:
            stmt = select(Template).options(selectinload(Template.category), selectinload(Template.creator)).order_by(Template.scope, Template.name)
            return list(session.scalars(stmt))

    def list_tags(self) -> list[Tag]:
        with self.session() as session:
            return list(session.scalars(select(Tag).order_by(Tag.name)))

    def list_notes(
        self,
        *,
        category_id: int | None = None,
        project_id: int | None = None,
        tag_name: str | None = None,
        search: str | None = None,
        author_id: int | None = None,
        note_type: str | None = None,
        include_children: bool = False,
        limit: int = 200,
    ) -> list[Note]:
        with self.session() as session:
            stmt = select(Note).options(
                selectinload(Note.category),
                selectinload(Note.project),
                selectinload(Note.template),
                selectinload(Note.author),
                selectinload(Note.tags),
            ).where(Note.is_archived.is_(False))
            if category_id is not None:
                stmt = stmt.where(Note.category_id == category_id)
            if project_id is not None:
                stmt = stmt.where(Note.project_id == project_id)
            if author_id is not None:
                stmt = stmt.where(Note.author_id == author_id)
            if note_type:
                stmt = stmt.where(Note.note_type == note_type)
            if not include_children:
                stmt = stmt.where(Note.parent_note_id.is_(None))
            if search:
                like = f"%{search.strip()}%"
                stmt = stmt.where(or_(Note.title.ilike(like), Note.body.ilike(like)))
            if tag_name:
                stmt = stmt.join(Note.tags).where(Tag.name == tag_name)
            stmt = stmt.order_by(desc(Note.is_pinned), desc(Note.updated_at)).limit(limit)
            return list(session.scalars(stmt))

    def get_note(self, note_id: int) -> Note | None:
        with self.session() as session:
            stmt = select(Note).options(
                selectinload(Note.category),
                selectinload(Note.project),
                selectinload(Note.template),
                selectinload(Note.author),
                selectinload(Note.tags),
            ).where(Note.id == note_id)
            return session.scalar(stmt)

    def save_note(
        self,
        note_id: int | None,
        *,
        title: str,
        body: str,
        category_id: int | None = None,
        project_id: int | None = None,
        template_id: int | None = None,
        author_id: int | None = None,
        parent_note_id: int | None = None,
        assigned_user_id: int | None = None,
        note_type: str = "note",
        visibility: str = "team",
        is_pinned: bool = False,
        is_milestone: bool = False,
        is_archived: bool = False,
        milestone_date: datetime | None = None,
        due_date: datetime | None = None,
        completed_at: datetime | None = None,
        tag_names: Iterable[str],
    ) -> Note:
        with self.session() as session:
            note = session.get(Note, note_id) if note_id else Note()
            note.title = title.strip()
            note.body = body
            note.category_id = category_id
            note.project_id = project_id
            note.template_id = template_id
            note.author_id = author_id
            note.parent_note_id = parent_note_id
            note.assigned_user_id = assigned_user_id
            note.note_type = note_type
            note.visibility = visibility
            note.is_pinned = is_pinned
            note.is_milestone = is_milestone
            note.is_archived = is_archived
            note.milestone_date = milestone_date
            note.due_date = due_date
            note.completed_at = completed_at
            note.tags = self._resolve_tags(session, tag_names)
            session.add(note)
            session.commit()
            return note

    def delete_note(self, note_id: int) -> None:
        with self.session() as session:
            note = session.get(Note, note_id)
            if note:
                session.delete(note)
                session.commit()

    def save_template(
        self,
        template_id: int | None,
        *,
        name: str,
        scope: str,
        content: str,
        category_id: int | None,
        created_by_id: int | None,
    ) -> Template:
        with self.session() as session:
            template = session.get(Template, template_id) if template_id else Template()
            template.name = name.strip()
            template.scope = scope
            template.content = content
            template.category_id = category_id
            template.created_by_id = created_by_id
            session.add(template)
            session.commit()
            return template

    def save_project(
        self,
        project_id: int | None,
        *,
        name: str,
        description: str = "",
        status: str = "active",
        owner_id: int | None = None,
        milestone_date: datetime | None = None,
        tag_names: Iterable[str],
    ) -> Project:
        with self.session() as session:
            project = session.get(Project, project_id) if project_id else Project()
            project.name = name.strip()
            project.description = description
            project.status = status
            project.owner_id = owner_id
            project.milestone_date = milestone_date
            project.tags = self._resolve_tags(session, tag_names)
            session.add(project)
            session.commit()
            return project

    def save_todo(
        self,
        todo_id: int | None,
        *,
        title: str,
        body: str,
        project_id: int | None,
        note_id: int | None,
        created_by_id: int | None,
        assigned_to_id: int | None,
        is_done: bool,
        due_date: datetime | None,
    ) -> TodoItem:
        with self.session() as session:
            todo = session.get(TodoItem, todo_id) if todo_id else TodoItem()
            todo.title = title.strip()
            todo.body = body
            todo.project_id = project_id
            todo.note_id = note_id
            todo.created_by_id = created_by_id
            todo.assigned_to_id = assigned_to_id
            todo.is_done = is_done
            todo.due_date = due_date
            todo.completed_at = datetime.utcnow() if is_done else None
            session.add(todo)
            session.commit()
            return todo

    def save_update(self, update_id: int | None, *, title: str, body: str, project_id: int | None, note_id: int | None, created_by_id: int | None) -> UpdateItem:
        with self.session() as session:
            update = session.get(UpdateItem, update_id) if update_id else UpdateItem()
            update.title = title.strip()
            update.body = body
            update.project_id = project_id
            update.note_id = note_id
            update.created_by_id = created_by_id
            session.add(update)
            session.commit()
            return update

    def toggle_todo(self, todo_id: int, is_done: bool) -> None:
        with self.session() as session:
            todo = session.get(TodoItem, todo_id)
            if todo:
                todo.is_done = is_done
                todo.completed_at = datetime.utcnow() if is_done else None
                session.commit()

    def dashboard_snapshot(self) -> dict[str, object]:
        with self.session() as session:
            totals = {
                "notes": session.scalar(select(func.count()).select_from(Note)) or 0,
                "projects": session.scalar(select(func.count()).select_from(Project)) or 0,
                "todos": session.scalar(select(func.count()).select_from(TodoItem)) or 0,
                "updates": session.scalar(select(func.count()).select_from(UpdateItem)) or 0,
                "milestones": session.scalar(select(func.count()).select_from(Note).where(Note.is_milestone.is_(True))) or 0,
            }
            pending_todos = session.scalar(
                select(func.count()).select_from(Note).where(Note.note_type == "todo", Note.is_archived.is_(False))
            ) or 0
            completed_todos = session.scalar(
                select(func.count()).select_from(Note).where(Note.note_type == "todo", Note.is_archived.is_(True))
            ) or 0
            completed_milestones = session.scalar(
                select(func.count()).select_from(Note).where(Note.is_milestone.is_(True), Note.is_archived.is_(True))
            ) or 0
            recent_notes = list(
                session.scalars(
                    select(Note)
                    .options(selectinload(Note.category), selectinload(Note.project), selectinload(Note.author), selectinload(Note.tags))
                    .order_by(desc(Note.updated_at))
                    .limit(8)
                )
            )
            notes_with_open_todos = list(
                session.scalars(
                    select(Note)
                    .options(selectinload(Note.category), selectinload(Note.project), selectinload(Note.author), selectinload(Note.tags))
                    .where(Note.parent_note_id.is_(None), Note.is_archived.is_(False))
                    .order_by(desc(Note.updated_at))
                    .limit(40)
                )
            )
            upcoming_milestones = list(
                session.scalars(
                    select(Note)
                    .options(selectinload(Note.category), selectinload(Note.project), selectinload(Note.author), selectinload(Note.tags))
                    .where(Note.is_milestone.is_(True), Note.is_archived.is_(False), Note.milestone_date.is_not(None))
                    .order_by(Note.milestone_date.asc())
                    .limit(8)
                )
            )
            upcoming_tasks = list(
                session.scalars(
                    select(Note)
                    .options(selectinload(Note.category), selectinload(Note.project), selectinload(Note.author), selectinload(Note.tags))
                    .where(Note.note_type == "todo", Note.is_archived.is_(False), Note.due_date.is_not(None))
                    .order_by(Note.due_date.asc())
                    .limit(8)
                )
            )

            project_rows = list(
                session.execute(
                    select(Project, func.count(Note.id).label("open_count"))
                    .join(Note, Note.project_id == Project.id)
                    .where(Note.note_type == "todo", Note.is_archived.is_(False))
                    .group_by(Project.id)
                    .order_by(func.count(Note.id).desc())
                    .limit(8)
                )
            )

            note_rows: list[tuple[Note, int]] = []
            for parent in notes_with_open_todos:
                open_children = session.scalar(
                    select(func.count())
                    .select_from(Note)
                    .where(Note.parent_note_id == parent.id, Note.note_type == "todo", Note.is_archived.is_(False))
                ) or 0
                if open_children > 0:
                    note_rows.append((parent, int(open_children)))
            note_rows.sort(key=lambda x: x[1], reverse=True)

            return {
                "totals": totals,
                "pending_todos": int(pending_todos),
                "completed_todos": int(completed_todos),
                "completed_milestones": int(completed_milestones),
                "notes": recent_notes,
                "upcoming_milestones": upcoming_milestones,
                "upcoming_tasks": upcoming_tasks,
                "notes_with_open_todos": note_rows[:8],
                "projects_with_open_todos": project_rows,
            }

    def milestones_for_period(self, start: datetime, end: datetime) -> list[Note]:
        with self.session() as session:
            stmt = (
                select(Note)
                .options(selectinload(Note.category), selectinload(Note.project), selectinload(Note.author), selectinload(Note.tags))
                .where(Note.is_milestone.is_(True), Note.created_at >= start, Note.created_at <= end)
                .order_by(desc(Note.created_at))
            )
            return list(session.scalars(stmt))

    def notes_for_user_period(self, user_id: int, start: datetime, end: datetime) -> list[Note]:
        with self.session() as session:
            stmt = (
                select(Note)
                .options(selectinload(Note.category), selectinload(Note.project), selectinload(Note.author), selectinload(Note.tags))
                .where(Note.author_id == user_id, Note.created_at >= start, Note.created_at <= end)
                .order_by(desc(Note.created_at))
            )
            return list(session.scalars(stmt))

    def search_everything(self, query: str) -> dict[str, list[object]]:
        pattern = f"%{query.strip()}%"
        with self.session() as session:
            return {
                "users": list(session.scalars(select(User).where(or_(User.username.ilike(pattern), User.full_name.ilike(pattern))).order_by(User.username))),
                "notes": list(session.scalars(select(Note).where(or_(Note.title.ilike(pattern), Note.body.ilike(pattern))).order_by(desc(Note.updated_at)))),
                "projects": list(session.scalars(select(Project).where(or_(Project.name.ilike(pattern), Project.description.ilike(pattern))).order_by(Project.name))),
                "templates": list(session.scalars(select(Template).where(or_(Template.name.ilike(pattern), Template.content.ilike(pattern))).order_by(Template.name))),
                "milestones": list(session.scalars(select(Note).where(Note.is_milestone.is_(True), or_(Note.title.ilike(pattern), Note.body.ilike(pattern))).order_by(desc(Note.created_at)))),
            }

    def export_notes_html(self, notes: list[Note], title: str) -> str:
        template = Environment(loader=BaseLoader()).from_string(
            """
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>{{ title }}</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; margin: 32px; color: #0f172a; }
    h1, h2, h3 { color: #0f172a; }
    .note { border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; margin-bottom: 18px; background: #fff; }
    .meta { color: #64748b; font-size: 0.9rem; margin-bottom: 8px; }
  </style>
</head>
<body>
  <h1>{{ title }}</h1>
  {% for note in notes %}
    <section class="note">
      <div class="meta">{{ note.created_at.strftime('%Y-%m-%d %H:%M') }}{% if note.category %} · {{ note.category.name }}{% endif %}{% if note.project %} · {{ note.project.name }}{% endif %}</div>
      <h2>{{ note.title }}</h2>
      <div>{{ note.body_html | safe }}</div>
    </section>
  {% endfor %}
</body>
</html>
"""
        )
        rendered = [
            {"note": note, "body_html": self.render_markdown(note.body)}
            for note in notes
        ]
        return template.render(title=title, notes=rendered)

    def _resolve_tags(self, session: Session, tag_names: Iterable[str]) -> list[Tag]:
        resolved: list[Tag] = []
        for raw_name in tag_names:
            name = raw_name.strip()
            if not name:
                continue
            tag = session.scalar(select(Tag).where(Tag.name == name))
            if tag is None:
                tag = Tag(name=name)
                session.add(tag)
                session.flush()
            resolved.append(tag)
        return resolved
