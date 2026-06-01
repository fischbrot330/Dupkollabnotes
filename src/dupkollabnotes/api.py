"""FastAPI-Backend – ersetzt die Tauri/Rust-Commands."""
from __future__ import annotations

import json
from datetime import datetime, timedelta
import os
from pathlib import Path
import re
import subprocess
import sys
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError

from .config import AppSettings
from .core.database import DatabaseManager
from .core.models import Category as CategoryModel
from .core.services import AppService

# ---------------------------------------------------------------------------
# App-Setup
# ---------------------------------------------------------------------------

settings = AppSettings.load()
db_manager = DatabaseManager(settings.database_url())
svc = AppService(db_manager)

SYSTEM_CATEGORIES = ("Aufgabe", "Update", "Misc", "Kommentar", "Feedback", "Meeting Notes", "Milestone")

app = FastAPI(title="SynkNote API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Hilfsfunktion: SQLAlchemy-Objekt → dict (lazy-safe)
# ---------------------------------------------------------------------------

def _model_to_dict(obj: Any) -> dict:
    """Wandelt ein SQLAlchemy-ORM-Objekt in ein JSON-serialisierbares dict um."""
    result: dict = {}
    for col in obj.__class__.__table__.columns:
        val = getattr(obj, col.name)
        if isinstance(val, datetime):
            val = val.isoformat()
        result[col.name] = val
    return result


def _parse_optional_datetime(raw: str | None) -> datetime | None:
    if not raw:
        return None
    value = raw.strip()
    if not value:
        return None
    if len(value) == 10:
        value = f"{value}T00:00:00"
    return datetime.fromisoformat(value)


def _handle_integrity_error(exc: IntegrityError, *, duplicate_name_msg: str) -> None:
    """Mappt DB-Integrity-Fehler auf sinnvolle HTTP-Fehlercodes."""
    msg = str(getattr(exc, "orig", exc)).lower()
    if "unique constraint failed" in msg:
        raise HTTPException(status_code=409, detail=duplicate_name_msg)
    raise HTTPException(status_code=400, detail="Ungültige Daten")


def _resolve_required_category_id(category_id: int | None) -> int:
    """Stellt sicher, dass Notizen immer eine Kategorie besitzen (Fallback: Misc)."""
    from sqlalchemy import select

    if category_id is not None:
        return category_id

    _ensure_system_categories()
    with svc.session() as session:
        misc = session.scalar(select(CategoryModel).where(CategoryModel.name == "Misc"))
        if misc is None:
            raise HTTPException(status_code=500, detail="Kategorie 'Misc' konnte nicht aufgelöst werden")
        return misc.id


def _ensure_system_categories() -> None:
    from sqlalchemy import select
    with svc.session() as session:
        existing = {c.name for c in session.scalars(select(CategoryModel))}
        changed = False
        for name in SYSTEM_CATEGORIES:
            if name not in existing:
                session.add(CategoryModel(name=name, color="#64748b"))
                changed = True
        if changed:
            session.commit()


_ensure_system_categories()


def _require_existing_user(user_id: int | None):
    effective_user_id = user_id if user_id is not None else AppSettings.load().active_user_id
    if effective_user_id is None:
        raise HTTPException(status_code=403, detail="Benutzerkontext fehlt")
    from .core.models import User
    with svc.session() as session:
        user = session.get(User, effective_user_id)
        if not user or not user.is_active:
            raise HTTPException(status_code=403, detail="Benutzer nicht gefunden oder inaktiv")
        return user


def _require_admin_user(user_id: int | None):
    user = _require_existing_user(user_id)
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Nur Admins dürfen diese Änderung vornehmen")
    return user


def _require_ai_enabled_user(user_id: int | None):
    user = _require_existing_user(user_id)
    if not user.can_use_ai_functions:
        raise HTTPException(status_code=403, detail="AI-Funktionen sind für diesen Benutzer nicht freigeschaltet")
    return user


# ---------------------------------------------------------------------------
# Pydantic-Schemas (Eingabe)
# ---------------------------------------------------------------------------

class AuthInput(BaseModel):
    username: str
    password: str

class ChangePasswordInput(BaseModel):
    user_id: int
    old_password: str
    new_password: str

class NoteFilter(BaseModel):
    search: str | None = None
    category_id: int | None = None
    project_id: int | None = None
    author_id: int | None = None
    viewer_id: int | None = None
    tag_id: int | None = None
    note_type: str | None = None
    period: str = "weekly"
    start_date: str | None = None
    end_date: str | None = None
    include_archived: bool = False


class ProjectListFilter(BaseModel):
    search: str | None = None
    status: str | None = None
    owner_id: int | None = None
    include_archived: bool = False


class OpenOutlookDraftInput(BaseModel):
    subject: str
    body: str


class AdvancedSearchInput(BaseModel):
    query: str = ""
    exact_match: bool = False
    category_ids: list[int] = []
    tag_ids: list[int] = []
    author_ids: list[int] = []
    project_ids: list[int] = []
    period: str = "all"
    start_date: str | None = None
    end_date: str | None = None
    viewer_id: int | None = None
    limit: int = 120


class TodoBoardFilterInput(BaseModel):
    search: str | None = None
    status: str = "all"
    category_id: int | None = None
    project_id: int | None = None
    viewer_id: int | None = None

class CreateNoteInput(BaseModel):
    title: str
    content: str
    category_id: int | None = None
    project_id: int | None = None
    template_id: int | None = None
    author_id: int | None = None
    assigned_user_id: int | None = None
    parent_note_id: int | None = None
    note_type: str = "note"
    visibility: str = "team"
    is_pinned: bool = False
    is_milestone: bool = False
    is_archived: bool = False
    milestone_date: str | None = None
    due_date: str | None = None
    completed_at: str | None = None
    tags: list[str] = []

class UpdateNoteInput(BaseModel):
    title: str | None = None
    content: str | None = None
    category_id: int | None = None
    project_id: int | None = None
    template_id: int | None = None
    author_id: int | None = None
    assigned_user_id: int | None = None
    parent_note_id: int | None = None
    note_type: str | None = None
    visibility: str | None = None
    is_pinned: bool | None = None
    is_milestone: bool | None = None
    is_archived: bool | None = None
    milestone_date: str | None = None
    due_date: str | None = None
    completed_at: str | None = None
    tags: list[str] | None = None

class CreateUserInput(BaseModel):
    username: str
    full_name: str
    role: str = "member"
    is_active: bool = True
    can_manage_projects: bool = False
    can_manage_templates: bool = False
    can_manage_users: bool = False
    can_use_ai_functions: bool | None = None
    acting_user_id: int | None = None
    password: str | None = None

class UpdateUserInput(BaseModel):
    username: str | None = None
    full_name: str | None = None
    role: str | None = None
    is_active: bool | None = None
    can_manage_projects: bool | None = None
    can_manage_templates: bool | None = None
    can_manage_users: bool | None = None
    can_use_ai_functions: bool | None = None
    acting_user_id: int | None = None
    password: str | None = None

class CreateProjectInput(BaseModel):
    name: str
    description: str | None = ""
    status: str = "active"
    owner_id: int | None = None
    milestone_date: str | None = None
    tags: list[str] = []


class MilestoneFilterInput(BaseModel):
    period: str = "monthly"
    start_date: str | None = None
    end_date: str | None = None
    viewer_id: int | None = None


class MilestoneAllFilterInput(BaseModel):
    search: str | None = None
    status: str = "all"
    project_id: int | None = None
    author_id: int | None = None
    has_date: str = "all"
    period: str = "all"
    start_date: str | None = None
    end_date: str | None = None
    viewer_id: int | None = None


def _normalize_visibility(raw: str | None) -> str:
    if raw == "private":
        return "private"
    return "team"


def _can_view_note(note, viewer_id: int | None) -> bool:
    visibility = _normalize_visibility(getattr(note, "visibility", None))
    if visibility == "private":
        return viewer_id is not None and note.author_id == viewer_id
    return True


def _normalize_for_search(value: str | None) -> str:
    return (value or "").strip().lower()


def _period_window(period: str, start_date: str | None, end_date: str | None) -> tuple[datetime | None, datetime | None]:
    now = datetime.utcnow()
    normalized = (period or "all").lower()

    if normalized == "all":
        return None, None
    if normalized == "weekly":
        return now - timedelta(days=7), now
    if normalized == "monthly":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = (start + timedelta(days=32)).replace(day=1) - timedelta(seconds=1)
        return start, end
    if normalized == "quarterly":
        q_month = ((now.month - 1) // 3) * 3 + 1
        start = now.replace(month=q_month, day=1, hour=0, minute=0, second=0, microsecond=0)
        end = (start + timedelta(days=95)).replace(day=1) - timedelta(seconds=1)
        return start, end
    if normalized == "custom":
        start = _parse_optional_datetime(start_date)
        end = _parse_optional_datetime(end_date)
        if not start or not end:
            raise HTTPException(status_code=400, detail="Custom-Zeitraum braucht start_date und end_date")
        return start, end
    raise HTTPException(status_code=400, detail="Ungültiger Zeitraum")


def _matches_query(text: str, query: str, *, exact_match: bool) -> bool:
    haystack = _normalize_for_search(text)
    needle = _normalize_for_search(query)
    if not needle:
        return True
    if exact_match:
        return needle in haystack
    terms = [t for t in re.split(r"\s+", needle) if t]
    return all(term in haystack for term in terms)


def _build_snippet(text: str, query: str, *, exact_match: bool) -> str:
    source = (text or "").replace("\n", " ").strip()
    if not source:
        return ""

    needle = _normalize_for_search(query)
    lower = source.lower()
    idx = lower.find(needle) if exact_match and needle else -1

    if idx < 0 and needle:
        terms = [t for t in re.split(r"\s+", needle) if t]
        hits = [lower.find(t) for t in terms if t]
        hits = [h for h in hits if h >= 0]
        idx = min(hits) if hits else -1

    if idx < 0:
        return source[:220]

    start = max(0, idx - 90)
    end = min(len(source), idx + 180)
    snippet = source[start:end]
    if start > 0:
        snippet = f"...{snippet}"
    if end < len(source):
        snippet = f"{snippet}..."
    return snippet

class CreateCategoryInput(BaseModel):
    name: str
    color: str | None = None


class UpdateCategoryInput(BaseModel):
    name: str
    color: str | None = None

class CreateTagInput(BaseModel):
    name: str
    color: str | None = None


class UpdateTagInput(BaseModel):
    name: str
    color: str | None = None

class CreateCommentInput(BaseModel):
    note_id: int
    author_id: int
    content: str
    comment_type: str = "comment"


class UpdateCommentInput(BaseModel):
    content: str
    comment_type: str = "comment"

class CreateTodoInput(BaseModel):
    project_id: int
    title: str
    content: str = ""
    due_date: str | None = None
    assigned_user_id: int | None = None

class CreateUpdateItemInput(BaseModel):
    project_id: int
    title: str | None = None
    content: str
    category_id: int | None = None
    tags: list[str] = []
    author_id: int | None = None

class CreateTemplateInput(BaseModel):
    name: str
    content: str
    category_id: int | None = None


class UpdateSettingsInput(BaseModel):
    database_path: str
    theme: str = "midnight"
    llm_model_path: str = ""
    acting_user_id: int | None = None


class AiPromptInput(BaseModel):
    user_id: int
    name: str
    content: str


class AiPromptUpdateInput(BaseModel):
    user_id: int
    name: str
    content: str


class AiNoteProcessInput(BaseModel):
    user_id: int
    prompt_id: int
    content: str


class CompleteTaskInput(BaseModel):
    author_id: int | None = None


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

@app.post("/api/auth/login")
def login(data: AuthInput):
    user = svc.authenticate(data.username, data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")
    s = AppSettings.load()
    s.active_user_id = user.id
    s.save()
    return _model_to_dict(user)

@app.post("/api/auth/change-password")
def change_password(data: ChangePasswordInput):
    from .core.security import verify_password, hash_password
    from sqlalchemy import select
    from .core.models import User
    with svc.session() as session:
        user = session.get(User, data.user_id)
        if not user:
            raise HTTPException(404, "Benutzer nicht gefunden")
        if not verify_password(data.old_password, user.password_salt, user.password_hash):
            raise HTTPException(400, "Altes Passwort falsch")
        user.password_salt, user.password_hash = hash_password(data.new_password)
        session.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Notes
# ---------------------------------------------------------------------------

def _note_summary(note) -> dict:
    from sqlalchemy import select
    from .core.models import Note, User

    d = _model_to_dict(note)
    d["author_name"] = note.author.full_name if note.author else None
    d["category_name"] = note.category.name if note.category else None
    d["category_color"] = note.category.color if note.category else None
    d["project_name"] = note.project.name if note.project else None
    d["tags"] = [{"id": t.id, "name": t.name, "color": t.color} for t in note.tags]
    d["content"] = d.pop("body", "")

    with svc.session() as session:
        assigned_user_name = None
        if note.assigned_user_id is not None:
            assigned_user = session.get(User, note.assigned_user_id)
            assigned_user_name = assigned_user.full_name if assigned_user else None
        children = list(
            session.scalars(
                select(Note).where(Note.parent_note_id == note.id, Note.is_archived.is_(False))
            )
        )
    d["assigned_user_name"] = assigned_user_name
    d["open_todos_count"] = sum(1 for c in children if c.note_type == "todo" and not c.is_archived)
    d["done_todos_count"] = sum(1 for c in children if c.note_type == "todo" and c.is_archived)
    d["new_comments_count"] = sum(1 for c in children if c.note_type == "comment" and not c.is_archived)
    d["feedback_count"] = sum(1 for c in children if c.note_type == "feedback" and not c.is_archived)
    d["questions_count"] = sum(1 for c in children if c.note_type == "question")
    d["updates_count"] = sum(1 for c in children if c.note_type == "update")
    d["milestone_status"] = "completed" if note.is_milestone and note.is_archived else "open"
    d["is_user_archived"] = getattr(note, "is_user_archived", False)
    return d

@app.post("/api/notes/list")
def list_notes(f: NoteFilter):
    hidden_categories = {"kommentar", "feedback"}
    start, end = _period_window(f.period, f.start_date, f.end_date)
    notes = svc.list_notes(
        search=f.search,
        category_id=f.category_id,
        project_id=f.project_id,
        author_id=f.author_id,
        note_type=f.note_type,
        include_children=False,
    )
    return [
        _note_summary(n)
        for n in notes
        if (n.category.name.lower() not in hidden_categories if n.category else True)
        and _can_view_note(n, f.viewer_id)
        and (start is None or n.created_at >= start)
        and (end is None or n.created_at <= end)
        and (f.include_archived or not getattr(n, "is_user_archived", False))
    ]


@app.post("/api/outlook/draft")
def open_outlook_draft(data: OpenOutlookDraftInput):
    import platform
    import base64
    import markdown as md_lib

    if platform.system().lower() != "windows":
        raise HTTPException(status_code=501, detail="Outlook-Integration ist nur unter Windows verfügbar")

    # Markdown → HTML
    html_body = md_lib.markdown(data.body, extensions=["tables", "fenced_code", "nl2br"])
    styled_html = (
        "<html><head><style>"
        "body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#222;}"
        "h1,h2,h3{color:#1a1a2e;}"
        "code{background:#f5f5f5;padding:2px 4px;border-radius:3px;font-family:Consolas,monospace;font-size:10pt;}"
        "pre{background:#f5f5f5;padding:12px;border-radius:6px;overflow-x:auto;}"
        "blockquote{border-left:3px solid #ccc;margin-left:0;padding-left:12px;color:#666;}"
        "table{border-collapse:collapse;width:100%;}"
        "td,th{border:1px solid #ddd;padding:6px 10px;}"
        "th{background:#f0f0f0;}"
        "</style></head><body>"
        + html_body
        + "</body></html>"
    )
    html_b64 = base64.b64encode(styled_html.encode("utf-8")).decode("ascii")

    pywin32_error: Exception | None = None
    try:
        import win32com.client  # type: ignore

        outlook = win32com.client.Dispatch("Outlook.Application")
        mail = outlook.CreateItem(0)
        mail.Subject = data.subject
        mail.HTMLBody = styled_html
        mail.Display()
    except Exception as exc:
        pywin32_error = exc
        # Fallback: COM direkt via PowerShell, falls pywin32/pywintypes in der venv defekt ist.
        ps_script = (
            "$ErrorActionPreference='Stop';"
            "$o=New-Object -ComObject Outlook.Application;"
            "$m=$o.CreateItem(0);"
            f"$m.Subject=@'\n{data.subject}\n'@;"
            f"$m.HTMLBody=[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('{html_b64}'));"
            "$m.Display()"
        )
        try:
            subprocess.run(
                [
                    "powershell",
                    "-NoProfile",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-Command",
                    ps_script,
                ],
                check=True,
                capture_output=True,
                text=True,
            )
        except Exception as fallback_exc:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Outlook-Mail konnte nicht erstellt werden. "
                    f"pywin32-Fehler: {pywin32_error}; "
                    f"Fallback-Fehler: {fallback_exc}"
                ),
            )

    return {"ok": True}

@app.get("/api/notes/{note_id}")
def get_note(note_id: int, viewer_id: int | None = None):
    note = svc.get_note(note_id)
    if not note:
        raise HTTPException(404, "Notiz nicht gefunden")
    if not _can_view_note(note, viewer_id):
        raise HTTPException(404, "Notiz nicht gefunden")
    return _note_summary(note)

@app.post("/api/notes")
def create_note(data: CreateNoteInput):
    from sqlalchemy import select
    category_id = _resolve_required_category_id(data.category_id)

    with svc.session() as session:
        milestone_cat = session.scalar(select(CategoryModel).where(CategoryModel.name == "Milestone"))
    is_milestone = data.is_milestone or (milestone_cat is not None and category_id == milestone_cat.id)

    note = svc.save_note(
        None,
        title=data.title,
        body=data.content,
        category_id=category_id,
        project_id=data.project_id,
        template_id=data.template_id,
        author_id=data.author_id,
        parent_note_id=data.parent_note_id,
        assigned_user_id=data.assigned_user_id,
        note_type=data.note_type,
        visibility=_normalize_visibility(data.visibility),
        is_pinned=data.is_pinned,
        is_milestone=is_milestone,
        is_archived=data.is_archived,
        milestone_date=_parse_optional_datetime(data.milestone_date),
        due_date=_parse_optional_datetime(data.due_date),
        completed_at=_parse_optional_datetime(data.completed_at),
        tag_names=data.tags,
    )
    return _note_summary(svc.get_note(note.id))

@app.put("/api/notes/{note_id}")
def update_note(note_id: int, data: UpdateNoteInput):
    from sqlalchemy import select

    existing = svc.get_note(note_id)
    if not existing:
        raise HTTPException(404, "Notiz nicht gefunden")
    with svc.session() as session:
        milestone_cat = session.scalar(select(CategoryModel).where(CategoryModel.name == "Milestone"))
    target_category_id = _resolve_required_category_id(data.category_id if data.category_id is not None else existing.category_id)
    is_milestone = data.is_milestone if data.is_milestone is not None else existing.is_milestone
    if milestone_cat is not None and target_category_id == milestone_cat.id:
        is_milestone = True

    note = svc.save_note(
        note_id,
        title=data.title if data.title is not None else existing.title,
        body=data.content if data.content is not None else existing.body,
        category_id=target_category_id,
        project_id=data.project_id if data.project_id is not None else existing.project_id,
        template_id=data.template_id if data.template_id is not None else existing.template_id,
        author_id=data.author_id if data.author_id is not None else existing.author_id,
        parent_note_id=data.parent_note_id if data.parent_note_id is not None else existing.parent_note_id,
        assigned_user_id=data.assigned_user_id if data.assigned_user_id is not None else existing.assigned_user_id,
        note_type=data.note_type if data.note_type is not None else existing.note_type,
        visibility=_normalize_visibility(data.visibility if data.visibility is not None else existing.visibility),
        is_pinned=data.is_pinned if data.is_pinned is not None else existing.is_pinned,
        is_milestone=is_milestone,
        is_archived=data.is_archived if data.is_archived is not None else existing.is_archived,
        milestone_date=_parse_optional_datetime(data.milestone_date) if data.milestone_date is not None else existing.milestone_date,
        due_date=_parse_optional_datetime(data.due_date) if data.due_date is not None else existing.due_date,
        completed_at=_parse_optional_datetime(data.completed_at) if data.completed_at is not None else existing.completed_at,
        tag_names=data.tags if data.tags is not None else [t.name for t in existing.tags],
    )
    return _note_summary(svc.get_note(note.id))

@app.delete("/api/notes/{note_id}")
def delete_note(note_id: int):
    svc.delete_note(note_id)
    return {"ok": True}


@app.post("/api/notes/{note_id}/archive-toggle")
def toggle_note_archive(note_id: int):
    from .core.models import Note
    with svc.session() as session:
        note = session.get(Note, note_id)
        if not note:
            raise HTTPException(status_code=404, detail="Notiz nicht gefunden")
        current = getattr(note, "is_user_archived", False)
        note.is_user_archived = not current
        session.commit()
    return _note_summary(svc.get_note(note_id))


# ---------------------------------------------------------------------------
# Comments (Stub – Modell hat keine Comment-Klasse, TODO anpassen)
# ---------------------------------------------------------------------------

@app.get("/api/notes/{note_id}/comments")
def list_comments(note_id: int):
    from sqlalchemy import select
    from .core.models import Note, User
    _ensure_system_categories()
    with svc.session() as session:
        note = session.get(Note, note_id)
        if not note:
            return []
        comment_cat = session.scalar(select(CategoryModel).where(CategoryModel.name == "Kommentar"))
        if not comment_cat:
            return []
        comments = list(
            session.scalars(
                select(Note)
                .where(
                    Note.parent_note_id == note_id,
                    Note.category_id == comment_cat.id,
                )
                .order_by(Note.created_at.asc())
            )
        )
        if not comments:
            # Rueckfall fuer Alt-Daten mit Prefix-basiertem Mapping.
            prefix = f"[comment:{note_id}]"
            comments = list(
                session.scalars(
                    select(Note)
                    .where(
                        Note.project_id == note.project_id,
                        Note.category_id == comment_cat.id,
                        Note.title.like(f"{prefix}%"),
                    )
                    .order_by(Note.created_at.asc())
                )
            )
        users_by_id = {u.id: u.full_name for u in session.scalars(select(User))}
    result = []
    for c in comments:
        result.append(
            {
                "id": c.id,
                "note_id": note_id,
                "author_id": c.author_id,
                "author_name": users_by_id.get(c.author_id, "Unbekannt"),
                "content": c.body,
                "comment_type": c.note_type or "comment",
                "is_resolved": c.is_archived,
                "created_at": c.created_at.isoformat() if c.created_at else datetime.utcnow().isoformat(),
            }
        )
    return result

@app.post("/api/comments")
def add_comment(data: CreateCommentInput):
    from sqlalchemy import select
    from .core.models import Note, User
    _ensure_system_categories()
    with svc.session() as session:
        base = session.get(Note, data.note_id)
        if not base:
            raise HTTPException(status_code=404, detail="Notiz nicht gefunden")
        comment_cat = session.scalar(select(CategoryModel).where(CategoryModel.name == "Kommentar"))
        prefix = f"[comment:{data.note_id}]"
        comment = svc.save_note(
            None,
            title=f"{prefix} {data.comment_type}",
            body=data.content,
            category_id=comment_cat.id if comment_cat else None,
            project_id=base.project_id,
            template_id=None,
            author_id=data.author_id,
            parent_note_id=data.note_id,
            assigned_user_id=None,
            note_type=data.comment_type,
            visibility=base.visibility,
            is_pinned=False,
            is_milestone=False,
            is_archived=False,
            milestone_date=None,
            due_date=None,
            completed_at=None,
            tag_names=[],
        )
        user = session.get(User, data.author_id)
    return {
        "id": comment.id,
        "note_id": data.note_id,
        "author_id": data.author_id,
        "author_name": user.full_name if user else "Unbekannt",
        "content": data.content,
        "comment_type": data.comment_type,
        "is_resolved": False,
        "created_at": comment.created_at.isoformat() if comment.created_at else datetime.utcnow().isoformat(),
    }


@app.put("/api/comments/{comment_id}")
def update_comment(comment_id: int, data: UpdateCommentInput):
    from .core.models import Note, User
    with svc.session() as session:
        comment = session.get(Note, comment_id)
        if not comment:
            raise HTTPException(status_code=404, detail="Kommentar nicht gefunden")
        comment.body = data.content
        comment.note_type = data.comment_type
        if comment.parent_note_id:
            comment.title = f"[comment:{comment.parent_note_id}] {data.comment_type}"
        session.commit()
        user = session.get(User, comment.author_id) if comment.author_id else None
    return {
        "id": comment.id,
        "note_id": comment.parent_note_id,
        "author_id": comment.author_id,
        "author_name": user.full_name if user else "Unbekannt",
        "content": comment.body,
        "comment_type": comment.note_type or "comment",
        "is_resolved": comment.is_archived,
        "created_at": comment.created_at.isoformat() if comment.created_at else datetime.utcnow().isoformat(),
    }

@app.delete("/api/comments/{comment_id}")
def delete_comment(comment_id: int):
    svc.delete_note(comment_id)
    return {"ok": True}

@app.post("/api/comments/{comment_id}/resolve")
def resolve_comment(comment_id: int):
    from .core.models import Note, User
    with svc.session() as session:
        comment = session.get(Note, comment_id)
        if not comment:
            raise HTTPException(status_code=404, detail="Kommentar nicht gefunden")
        comment.is_archived = True
        session.commit()
        user = session.get(User, comment.author_id) if comment.author_id else None
        note_ref = comment.parent_note_id
    return {
        "id": comment.id,
        "note_id": note_ref,
        "author_id": comment.author_id,
        "author_name": user.full_name if user else "Unbekannt",
        "content": comment.body,
        "comment_type": comment.note_type or "comment",
        "is_resolved": True,
        "created_at": comment.created_at.isoformat() if comment.created_at else datetime.utcnow().isoformat(),
    }


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------

def _project_summary(p) -> dict:
    from sqlalchemy import inspect as sa_inspect

    d = _model_to_dict(p)
    state = sa_inspect(p)

    owner_loaded = "owner" not in state.unloaded
    tags_loaded = "tags" not in state.unloaded
    todos_loaded = "todos" not in state.unloaded
    notes_loaded = "notes" not in state.unloaded

    owner = p.owner if owner_loaded else None
    tags = p.tags if tags_loaded and p.tags is not None else []
    todos = p.todos if todos_loaded and p.todos is not None else []
    notes = p.notes if notes_loaded and p.notes is not None else []

    d["owner_name"] = owner.full_name if owner else None
    d["tags"] = [{"id": t.id, "name": t.name, "color": t.color} for t in tags]
    d["todo_count"] = len(todos)
    d["done_count"] = sum(1 for t in todos if t.is_done)
    root_notes = [n for n in notes if n.parent_note_id is None]
    child_notes = [n for n in notes if n.parent_note_id is not None]
    open_root_notes = [n for n in root_notes if not n.is_archived]
    open_child_notes = [n for n in child_notes if not n.is_archived]
    d["open_todos_count"] = sum(1 for n in open_root_notes + open_child_notes if n.note_type == "todo")
    d["new_comments_count"] = sum(1 for n in open_child_notes if n.note_type == "comment")
    d["questions_count"] = sum(1 for n in open_child_notes if n.note_type == "question")
    d["updates_count"] = sum(1 for n in open_root_notes if n.note_type == "update")
    d["open_milestones_count"] = sum(1 for n in root_notes if n.is_milestone and not n.is_archived)
    d["completed_milestones_count"] = sum(1 for n in root_notes if n.is_milestone and n.is_archived)
    d["is_user_archived"] = getattr(p, "is_user_archived", False)
    return d


def _todo_to_api_dict(todo, users_by_id: dict[int, str] | None = None) -> dict:
    d = _model_to_dict(todo)
    assigned_user_id = d.get("assigned_to_id")
    d["assigned_user_id"] = assigned_user_id
    if users_by_id and assigned_user_id is not None:
        d["assigned_user_name"] = users_by_id.get(assigned_user_id)
    else:
        d["assigned_user_name"] = None
    d["content"] = d.pop("body", "")
    return d


def _project_note_to_update_dict(note, users_by_id: dict[int, str] | None = None) -> dict:
    d = _note_summary(note)
    return {
        "id": d["id"],
        "project_id": d.get("project_id"),
        "title": d.get("title", ""),
        "content": d.get("content", ""),
        "author_id": d.get("author_id"),
        "author_name": (users_by_id or {}).get(d.get("author_id")) if d.get("author_id") is not None else d.get("author_name"),
        "category_id": d.get("category_id"),
        "category_name": d.get("category_name"),
        "note_type": d.get("note_type", "note"),
        "visibility": d.get("visibility", "team"),
        "assigned_user_id": d.get("assigned_user_id"),
        "assigned_user_name": d.get("assigned_user_name"),
        "open_todos_count": d.get("open_todos_count", 0),
        "done_todos_count": d.get("done_todos_count", 0),
        "new_comments_count": d.get("new_comments_count", 0),
        "feedback_count": d.get("feedback_count", 0),
        "questions_count": d.get("questions_count", 0),
        "updates_count": d.get("updates_count", 0),
        "tags": d.get("tags", []),
        "is_milestone": d.get("is_milestone", False),
        "is_archived": d.get("is_archived", False),
        "is_user_archived": d.get("is_user_archived", False),
        "milestone_date": d.get("milestone_date"),
        "due_date": d.get("due_date"),
        "completed_at": d.get("completed_at"),
        "created_at": d.get("created_at"),
        "updated_at": d.get("updated_at"),
    }


def _load_project_with_relations(project_id: int):
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from .core.models import Project

    with svc.session() as session:
        return session.scalar(
            select(Project)
            .options(
                selectinload(Project.owner),
                selectinload(Project.tags),
                selectinload(Project.todos),
                selectinload(Project.updates),
            )
            .where(Project.id == project_id)
        )

@app.post("/api/projects/list")
def list_projects(f: ProjectListFilter | None = None):
    include_archived = f.include_archived if f else False
    projects = svc.list_projects()
    return [
        _project_summary(p)
        for p in projects
        if include_archived or not getattr(p, "is_user_archived", False)
    ]


@app.post("/api/projects/{project_id}/archive-toggle")
def toggle_project_archive(project_id: int):
    from sqlalchemy import select
    from .core.models import Project, Note
    with svc.session() as session:
        project = session.get(Project, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Projekt nicht gefunden")
        current = getattr(project, "is_user_archived", False)
        new_state = not current
        project.is_user_archived = new_state
        # Cascade: archive/unarchive all project notes
        project_notes = list(session.scalars(
            select(Note).where(Note.project_id == project_id, Note.parent_note_id.is_(None))
        ))
        for note in project_notes:
            note.is_user_archived = new_state
        session.commit()
    loaded = _load_project_with_relations(project_id)
    if not loaded:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")
    return _project_summary(loaded)

@app.get("/api/projects/{project_id}")
def get_project(project_id: int, viewer_id: int | None = None, include_archived: bool = False):
    from sqlalchemy import select
    from .core.models import Project, Note, User
    from sqlalchemy.orm import selectinload
    with svc.session() as session:
        p = session.scalar(
            select(Project)
            .options(
                selectinload(Project.owner),
                selectinload(Project.tags),
                selectinload(Project.todos),
                selectinload(Project.notes).selectinload(Note.author),
                selectinload(Project.notes).selectinload(Note.category),
                selectinload(Project.notes).selectinload(Note.project),
                selectinload(Project.notes).selectinload(Note.tags),
            )
            .where(Project.id == project_id)
        )
        users_by_id = {u.id: u.full_name for u in session.scalars(select(User))}
    if not p:
        raise HTTPException(404, "Projekt nicht gefunden")
    d = _project_summary(p)
    d["description"] = p.description
    d["todos"] = [_todo_to_api_dict(t, users_by_id) for t in p.todos]
    visible_root_notes = [
        n
        for n in p.notes
        if n.parent_note_id is None
        and _can_view_note(n, viewer_id)
        and (include_archived or not getattr(n, "is_user_archived", False))
    ]
    # All notes (tasks+milestones+updates), split by milestone flag
    project_notes = sorted(
        [n for n in visible_root_notes if not n.is_milestone],
        key=lambda n: n.updated_at,
        reverse=True,
    )
    milestones = sorted(
        [n for n in visible_root_notes if n.is_milestone],
        key=lambda n: (n.milestone_date or n.updated_at),
    )
    d["updates"] = [_project_note_to_update_dict(n, users_by_id) for n in project_notes]
    d["milestones"] = [_project_note_to_update_dict(n, users_by_id) for n in milestones]
    return d


@app.post("/api/tasks/{note_id}/complete")
def complete_task_note(note_id: int, data: CompleteTaskInput):
    from .core.models import Note
    with svc.session() as session:
        note = session.get(Note, note_id)
        if not note:
            raise HTTPException(status_code=404, detail="Aufgaben-Notiz nicht gefunden")
        note.is_archived = True
        note.completed_at = datetime.utcnow()
        if data.author_id is not None:
            note.author_id = data.author_id
        session.commit()
        session.refresh(note)
    return _note_summary(svc.get_note(note.id))

@app.post("/api/projects")
def create_project(data: CreateProjectInput):
    try:
        p = svc.save_project(
            None,
            name=data.name,
            description=data.description or "",
            status=data.status,
            owner_id=data.owner_id,
            milestone_date=_parse_optional_datetime(data.milestone_date),
            tag_names=data.tags,
        )
    except IntegrityError as exc:
        _handle_integrity_error(exc, duplicate_name_msg="Projektname existiert bereits")
    loaded = _load_project_with_relations(p.id)
    if not loaded:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")
    return _project_summary(loaded)

@app.put("/api/projects/{project_id}")
def update_project(project_id: int, data: CreateProjectInput):
    try:
        p = svc.save_project(
            project_id,
            name=data.name,
            description=data.description or "",
            status=data.status,
            owner_id=data.owner_id,
            milestone_date=_parse_optional_datetime(data.milestone_date),
            tag_names=data.tags,
        )
    except IntegrityError as exc:
        _handle_integrity_error(exc, duplicate_name_msg="Projektname existiert bereits")
    loaded = _load_project_with_relations(p.id)
    if not loaded:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")
    return _project_summary(loaded)


# ---------------------------------------------------------------------------
# Todos
# ---------------------------------------------------------------------------

@app.post("/api/todos")
def create_todo(data: CreateTodoInput):
    todo = svc.save_todo(
        None,
        title=data.title,
        body=data.content,
        project_id=data.project_id,
        note_id=None,
        created_by_id=None,
        assigned_to_id=data.assigned_user_id,
        is_done=False,
        due_date=datetime.fromisoformat(data.due_date) if data.due_date else None,
    )
    from sqlalchemy import select
    from .core.models import User
    with svc.session() as session:
        users_by_id = {u.id: u.full_name for u in session.scalars(select(User))}
    return _todo_to_api_dict(todo, users_by_id)


@app.post("/api/todos/board")
def list_todo_board(data: TodoBoardFilterInput):
    from sqlalchemy import select, or_
    from sqlalchemy.orm import selectinload
    from .core.models import Note

    stmt = (
        select(Note)
        .options(
            selectinload(Note.category),
            selectinload(Note.project),
            selectinload(Note.author),
            selectinload(Note.tags),
        )
        .where(Note.note_type == "todo", Note.parent_note_id.is_(None))
    )

    if data.category_id is not None:
        stmt = stmt.where(Note.category_id == data.category_id)
    if data.project_id is not None:
        stmt = stmt.where(Note.project_id == data.project_id)
    if data.search:
        like = f"%{data.search.strip()}%"
        stmt = stmt.where(or_(Note.title.ilike(like), Note.body.ilike(like)))

    status = (data.status or "all").lower()
    if status == "open":
        stmt = stmt.where(Note.is_archived.is_(False))
    elif status == "done":
        stmt = stmt.where(Note.is_archived.is_(True))

    with svc.session() as session:
        tasks = list(session.scalars(stmt.order_by(Note.due_date.asc().nullslast(), Note.updated_at.desc())))

    return [_note_summary(t) for t in tasks if _can_view_note(t, data.viewer_id)]

@app.post("/api/todos/{todo_id}/toggle")
def toggle_todo(todo_id: int):
    from .core.models import TodoItem, User
    from sqlalchemy import select
    with svc.session() as session:
        todo = session.get(TodoItem, todo_id)
        if not todo:
            raise HTTPException(404, "Todo nicht gefunden")
        new_state = not todo.is_done
    svc.toggle_todo(todo_id, new_state)
    from .core.models import TodoItem
    with svc.session() as session:
        todo = session.get(TodoItem, todo_id)
        users_by_id = {u.id: u.full_name for u in session.scalars(select(User))}
        return _todo_to_api_dict(todo, users_by_id)


# ---------------------------------------------------------------------------
# Update-Items
# ---------------------------------------------------------------------------

@app.post("/api/updates")
def create_update_item(data: CreateUpdateItemInput):
    # Updates laufen als Projekt-Notizen, damit sie unter "Notizen/Updates" konsistent sind.
    note = svc.save_note(
        None,
        title=(data.title or "Update").strip() or "Update",
        body=data.content,
        category_id=data.category_id,
        project_id=data.project_id,
        template_id=None,
        author_id=data.author_id,
        parent_note_id=None,
        assigned_user_id=None,
        note_type="update",
        visibility="team",
        is_pinned=False,
        is_milestone=False,
        is_archived=False,
        milestone_date=None,
        due_date=None,
        completed_at=None,
        tag_names=data.tags,
    )
    loaded = svc.get_note(note.id)
    return _project_note_to_update_dict(loaded)


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

@app.get("/api/users")
def list_users():
    return [_model_to_dict(u) for u in svc.list_users()]

@app.post("/api/users")
def create_user(data: CreateUserInput):
    can_use_ai_functions = data.can_use_ai_functions if data.can_use_ai_functions is not None else False
    if data.can_use_ai_functions is not None:
        _require_admin_user(data.acting_user_id)
    user = svc.upsert_user(
        None,
        username=data.username,
        full_name=data.full_name,
        role=data.role,
        is_active=data.is_active,
        can_manage_projects=data.can_manage_projects,
        can_manage_templates=data.can_manage_templates,
        can_manage_users=data.can_manage_users,
        can_use_ai_functions=can_use_ai_functions,
        password=data.password,
    )
    return _model_to_dict(user)

@app.put("/api/users/{user_id}")
def update_user(user_id: int, data: UpdateUserInput):
    from .core.models import User
    with svc.session() as session:
        existing = session.get(User, user_id)
        if not existing:
            raise HTTPException(404, "Benutzer nicht gefunden")
    if data.can_use_ai_functions is not None:
        _require_admin_user(data.acting_user_id)
    user = svc.upsert_user(
        user_id,
        username=data.username or existing.username,
        full_name=data.full_name or existing.full_name,
        role=data.role or existing.role,
        is_active=data.is_active if data.is_active is not None else existing.is_active,
        can_manage_projects=data.can_manage_projects if data.can_manage_projects is not None else existing.can_manage_projects,
        can_manage_templates=data.can_manage_templates if data.can_manage_templates is not None else existing.can_manage_templates,
        can_manage_users=data.can_manage_users if data.can_manage_users is not None else existing.can_manage_users,
        can_use_ai_functions=data.can_use_ai_functions if data.can_use_ai_functions is not None else existing.can_use_ai_functions,
        password=data.password,
    )
    return _model_to_dict(user)


# ---------------------------------------------------------------------------
# Categories & Tags
# ---------------------------------------------------------------------------

@app.get("/api/categories")
def list_categories():
    _ensure_system_categories()
    return [_model_to_dict(c) for c in svc.list_categories()]

@app.post("/api/categories")
def create_category(data: CreateCategoryInput):
    from .core.models import Category
    with svc.session() as session:
        cat = Category(name=data.name, color=data.color or "#3b82f6")
        session.add(cat)
        session.commit()
        return _model_to_dict(cat)


@app.put("/api/categories/{category_id}")
def update_category(category_id: int, data: UpdateCategoryInput):
    from .core.models import Category
    with svc.session() as session:
        cat = session.get(Category, category_id)
        if not cat:
            raise HTTPException(status_code=404, detail="Kategorie nicht gefunden")
        if cat.name in SYSTEM_CATEGORIES and data.name != cat.name:
            raise HTTPException(status_code=400, detail="System-Kategorien koennen nicht umbenannt werden")
        cat.name = data.name
        cat.color = data.color or "#64748b"
        session.commit()
        return _model_to_dict(cat)


@app.delete("/api/categories/{category_id}")
def delete_category(category_id: int):
    from .core.models import Category
    with svc.session() as session:
        cat = session.get(Category, category_id)
        if not cat:
            raise HTTPException(status_code=404, detail="Kategorie nicht gefunden")
        if cat.name in SYSTEM_CATEGORIES:
            raise HTTPException(status_code=400, detail="System-Kategorien koennen nicht geloescht werden")
        session.delete(cat)
        session.commit()
    return {"ok": True}

@app.get("/api/tags")
def list_tags():
    return [_model_to_dict(t) for t in svc.list_tags()]

@app.post("/api/tags")
def create_tag(data: CreateTagInput):
    from .core.models import Tag
    with svc.session() as session:
        tag = Tag(name=data.name, color=data.color or "#14b8a6")
        session.add(tag)
        session.commit()
        return _model_to_dict(tag)


@app.put("/api/tags/{tag_id}")
def update_tag(tag_id: int, data: UpdateTagInput):
    from .core.models import Tag
    with svc.session() as session:
        tag = session.get(Tag, tag_id)
        if not tag:
            raise HTTPException(status_code=404, detail="Tag nicht gefunden")
        tag.name = data.name
        tag.color = data.color or "#14b8a6"
        session.commit()
        return _model_to_dict(tag)


@app.delete("/api/tags/{tag_id}")
def delete_tag(tag_id: int):
    from .core.models import Tag
    with svc.session() as session:
        tag = session.get(Tag, tag_id)
        if not tag:
            raise HTTPException(status_code=404, detail="Tag nicht gefunden")
        session.delete(tag)
        session.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------

@app.get("/api/templates")
def list_templates():
    templates = svc.list_templates()
    result = []
    for t in templates:
        d = _model_to_dict(t)
        d["category_name"] = t.category.name if t.category else None
        result.append(d)
    return result

@app.post("/api/templates")
def create_template(data: CreateTemplateInput):
    t = svc.save_template(None, name=data.name, scope="note", content=data.content, category_id=data.category_id, created_by_id=None)
    return _model_to_dict(t)

@app.put("/api/templates/{template_id}")
def update_template(template_id: int, data: CreateTemplateInput):
    t = svc.save_template(template_id, name=data.name, scope="note", content=data.content, category_id=data.category_id, created_by_id=None)
    return _model_to_dict(t)

@app.delete("/api/templates/{template_id}")
def delete_template(template_id: int):
    from .core.models import Template
    with svc.session() as session:
        t = session.get(Template, template_id)
        if t:
            session.delete(t)
            session.commit()
    return {"ok": True}


@app.post("/api/milestones/list")
def list_milestones(data: MilestoneFilterInput):
    now = datetime.utcnow()
    period = (data.period or "monthly").lower()

    if period == "weekly":
        start = now - timedelta(days=7)
        end = now + timedelta(days=7)
    elif period == "monthly":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = (start + timedelta(days=32)).replace(day=1) - timedelta(seconds=1)
    elif period == "quarterly":
        quarter_start_month = ((now.month - 1) // 3) * 3 + 1
        start = now.replace(month=quarter_start_month, day=1, hour=0, minute=0, second=0, microsecond=0)
        end = (start + timedelta(days=95)).replace(day=1) - timedelta(seconds=1)
    elif period == "custom":
        if not data.start_date or not data.end_date:
            raise HTTPException(status_code=400, detail="Custom-Zeitraum braucht start_date und end_date")
        start = _parse_optional_datetime(data.start_date)
        end = _parse_optional_datetime(data.end_date)
        if not start or not end:
            raise HTTPException(status_code=400, detail="Ungültiges Datum")
    else:
        raise HTTPException(status_code=400, detail="Ungültiger Zeitraum")

    with svc.session() as session:
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload
        from .core.models import Note

        milestones = list(
            session.scalars(
                select(Note)
                .options(
                    selectinload(Note.category),
                    selectinload(Note.project),
                    selectinload(Note.author),
                    selectinload(Note.tags),
                )
                .where(
                    Note.is_milestone.is_(True),
                    Note.parent_note_id.is_(None),
                    Note.milestone_date.is_not(None),
                    Note.milestone_date >= start,
                    Note.milestone_date <= end,
                    Note.is_archived.is_(False),
                )
                .order_by(Note.milestone_date.asc())
            )
        )

    return [_note_summary(n) for n in milestones if _can_view_note(n, data.viewer_id)]


@app.post("/api/milestones/all")
def list_all_milestones(data: MilestoneAllFilterInput):
    start, end = _period_window(data.period, data.start_date, data.end_date)

    with svc.session() as session:
        from sqlalchemy import select, or_
        from sqlalchemy.orm import selectinload
        from .core.models import Note

        stmt = (
            select(Note)
            .options(
                selectinload(Note.category),
                selectinload(Note.project),
                selectinload(Note.author),
                selectinload(Note.tags),
            )
            .where(Note.is_milestone.is_(True), Note.parent_note_id.is_(None))
        )

        if data.project_id is not None:
            stmt = stmt.where(Note.project_id == data.project_id)

        if data.author_id is not None:
            stmt = stmt.where(Note.author_id == data.author_id)

        status = (data.status or "all").lower()
        if status == "open":
            stmt = stmt.where(Note.is_archived.is_(False))
        elif status == "completed":
            stmt = stmt.where(Note.is_archived.is_(True))

        has_date = (data.has_date or "all").lower()
        if has_date == "yes":
            stmt = stmt.where(Note.milestone_date.is_not(None))
        elif has_date == "no":
            stmt = stmt.where(Note.milestone_date.is_(None))

        if start is not None:
            stmt = stmt.where(Note.milestone_date.is_not(None), Note.milestone_date >= start)
        if end is not None:
            stmt = stmt.where(Note.milestone_date.is_not(None), Note.milestone_date <= end)

        if data.search:
            like = f"%{data.search.strip()}%"
            stmt = stmt.where(or_(Note.title.ilike(like), Note.body.ilike(like)))

        milestones = list(session.scalars(stmt.order_by(Note.updated_at.desc())))

    return [_note_summary(n) for n in milestones if _can_view_note(n, data.viewer_id)]


@app.get("/api/ai/prompts")
def list_ai_prompts(user_id: int):
    _require_ai_enabled_user(user_id)
    prompts = svc.list_ai_prompts(user_id)
    return [_model_to_dict(prompt) for prompt in prompts]


@app.post("/api/ai/prompts")
def create_ai_prompt(data: AiPromptInput):
    _require_ai_enabled_user(data.user_id)
    prompt = svc.save_ai_prompt(
        None,
        user_id=data.user_id,
        name=data.name,
        content=data.content,
    )
    return _model_to_dict(prompt)


@app.put("/api/ai/prompts/{prompt_id}")
def update_ai_prompt(prompt_id: int, data: AiPromptUpdateInput):
    _require_ai_enabled_user(data.user_id)
    try:
        prompt = svc.save_ai_prompt(
            prompt_id,
            user_id=data.user_id,
            name=data.name,
            content=data.content,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _model_to_dict(prompt)


@app.delete("/api/ai/prompts/{prompt_id}")
def delete_ai_prompt(prompt_id: int, user_id: int):
    _require_ai_enabled_user(user_id)
    svc.delete_ai_prompt(prompt_id, user_id=user_id)
    return {"ok": True}


@app.post("/api/ai/process")
def process_note_with_ai(data: AiNoteProcessInput):
    _require_ai_enabled_user(data.user_id)
    model_path = AppSettings.load().llm_model_path.strip()
    if not model_path:
        raise HTTPException(status_code=400, detail="Kein GGUF-Modellpfad in den Einstellungen hinterlegt")
    try:
        result = svc.process_note_content_with_ai(
            user_id=data.user_id,
            prompt_id=data.prompt_id,
            markdown_content=data.content,
            model_path=model_path,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"processed_content": result}


@app.get("/api/settings")
def get_settings():
    s = AppSettings.load()
    return {
        "database_path": s.database_path,
        "theme": s.theme,
        "llm_model_path": s.llm_model_path,
        "active_user_id": s.active_user_id,
        "resolved_database_path": str(s.resolved_database_path()),
        "resolved_llm_model_path": str(s.resolved_llm_model_path()) if s.resolved_llm_model_path() else "",
    }


@app.put("/api/settings")
def update_settings(data: UpdateSettingsInput):
    if data.llm_model_path.strip():
        _require_ai_enabled_user(data.acting_user_id)
    s = AppSettings.load()
    s.database_path = data.database_path
    s.theme = data.theme
    s.llm_model_path = data.llm_model_path
    s.save()
    return {
        "ok": True,
        "database_path": s.database_path,
        "theme": s.theme,
        "llm_model_path": s.llm_model_path,
        "requires_restart": True,
    }


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@app.get("/api/dashboard")
def dashboard(viewer_id: int | None = None):
    from .core.models import User as UserModel, Project as ProjectModel
    from sqlalchemy import select, func
    from sqlalchemy.orm import selectinload
    snap = svc.dashboard_snapshot()
    totals = snap["totals"]

    with svc.session() as session:
        active_users = session.scalar(
            select(func.count()).select_from(UserModel).where(UserModel.is_active.is_(True))
        ) or 0
        recent_projects = list(session.scalars(
            select(ProjectModel)
            .options(
                selectinload(ProjectModel.owner),
                selectinload(ProjectModel.tags),
                selectinload(ProjectModel.todos),
            )
            .order_by(ProjectModel.updated_at.desc())
            .limit(8)
        ))
        project_summaries = [_project_summary(p) for p in recent_projects]

    visible_recent_notes = [n for n in snap["notes"] if _can_view_note(n, viewer_id)]
    visible_upcoming_milestones = [n for n in snap["upcoming_milestones"] if _can_view_note(n, viewer_id)]
    visible_upcoming_tasks = [n for n in snap["upcoming_tasks"] if _can_view_note(n, viewer_id)]
    visible_notes_with_open_todos = [item for item in snap["notes_with_open_todos"] if _can_view_note(item[0], viewer_id)]

    return {
        "total_notes": totals["notes"],
        "total_projects": totals["projects"],
        "pending_todos": snap["pending_todos"],
        "completed_todos": snap["completed_todos"],
        "total_milestones": totals["milestones"],
        "completed_milestones": snap["completed_milestones"],
        "active_users": active_users,
        "recent_notes": [_note_summary(n) for n in visible_recent_notes],
        "recent_projects": project_summaries,
        "upcoming_milestones": [_note_summary(n) for n in visible_upcoming_milestones],
        "upcoming_tasks": [_note_summary(n) for n in visible_upcoming_tasks],
        "notes_with_open_todos": [
            {"note": _note_summary(item[0]), "open_todos": item[1]}
            for item in visible_notes_with_open_todos
        ],
        "projects_with_open_todos": [
            {"project": _project_summary(row[0]), "open_todos": int(row[1])}
            for row in snap["projects_with_open_todos"]
        ],
    }


@app.post("/api/search/advanced")
def advanced_search(data: AdvancedSearchInput):
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from .core.models import Note, Project

    start, end = _period_window(data.period, data.start_date, data.end_date)
    limit = min(max(data.limit, 20), 300)

    with svc.session() as session:
        notes = list(
            session.scalars(
                select(Note)
                .options(
                    selectinload(Note.category),
                    selectinload(Note.project),
                    selectinload(Note.author),
                    selectinload(Note.tags),
                )
                .where(Note.parent_note_id.is_(None))
                .order_by(Note.updated_at.desc())
            )
        )

        projects = list(
            session.scalars(
                select(Project)
                .options(
                    selectinload(Project.owner),
                    selectinload(Project.tags),
                    selectinload(Project.todos),
                    selectinload(Project.notes),
                )
                .order_by(Project.updated_at.desc())
            )
        )

    query = data.query or ""
    filter_tag_ids = set(data.tag_ids)

    filtered_notes = []
    for n in notes:
        if not _can_view_note(n, data.viewer_id):
            continue
        if data.category_ids and (n.category_id not in data.category_ids):
            continue
        if filter_tag_ids:
            note_tag_ids = {t.id for t in n.tags}
            if note_tag_ids.isdisjoint(filter_tag_ids):
                continue
        if data.author_ids and (n.author_id not in data.author_ids):
            continue
        if data.project_ids and (n.project_id not in data.project_ids):
            continue
        if start is not None and n.created_at < start:
            continue
        if end is not None and n.created_at > end:
            continue

        merged = f"{n.title or ''}\n{n.body or ''}"
        if query and not _matches_query(merged, query, exact_match=data.exact_match):
            continue

        filtered_notes.append({
            "note": _note_summary(n),
            "snippet": _build_snippet(merged, query, exact_match=data.exact_match),
        })
        if len(filtered_notes) >= limit:
            break

    filtered_projects = []
    for p in projects:
        if filter_tag_ids:
            project_tag_ids = {t.id for t in p.tags}
            if project_tag_ids.isdisjoint(filter_tag_ids):
                continue
        if data.author_ids and (p.owner_id not in data.author_ids):
            continue
        if data.project_ids and (p.id not in data.project_ids):
            continue
        if start is not None and p.created_at < start:
            continue
        if end is not None and p.created_at > end:
            continue

        merged = f"{p.name or ''}\n{p.description or ''}"
        if query and not _matches_query(merged, query, exact_match=data.exact_match):
            continue

        filtered_projects.append({
            "project": _project_summary(p),
            "snippet": _build_snippet(merged, query, exact_match=data.exact_match),
        })
        if len(filtered_projects) >= limit:
            break

    return {
        "notes": filtered_notes,
        "projects": filtered_projects,
    }


# ---------------------------------------------------------------------------
# Static Files (React-Build) – wird am Ende gemountet damit /api Vorrang hat
# ---------------------------------------------------------------------------

def _resolve_dist_dir() -> Path:
    env_dir = os.getenv("DUPKOLLABNOTES_DIST_DIR")
    if env_dir:
        candidate = Path(env_dir).expanduser().resolve()
        if candidate.exists():
            return candidate

    module_dist = Path(__file__).parent.parent.parent / "dist"
    if module_dist.exists():
        return module_dist

    cwd_dist = Path.cwd() / "dist"
    if cwd_dist.exists():
        return cwd_dist

    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        base = Path(meipass)
        for candidate in (base / "dist", base.parent / "dist"):
            if candidate.exists():
                return candidate

    return module_dist


_DIST = _resolve_dist_dir()
if _DIST.exists():
    app.mount("/", StaticFiles(directory=str(_DIST), html=True), name="static")
