from __future__ import annotations

from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from .models import AiPrompt, Base, Category, Project, Tag, Template, User
from .security import hash_password

DEFAULT_AI_PROMPTS = (
    ("Translate to English", "translate_to_english.txt"),
    ("Improve grammar and style", "improve_grammar_and_style.txt"),
    ("Improve structure", "improve_structure.txt"),
    ("Summarize", "summarize.txt"),
)


def _prompt_directory() -> Path:
    return Path(__file__).resolve().parents[3] / "docs" / "ai-prompts"


def _read_prompt_text(file_name: str) -> str:
    return (_prompt_directory() / file_name).read_text(encoding="utf-8").strip()


def ensure_default_ai_prompts_for_user(session: Session, user_id: int) -> None:
    existing = {
        name
        for (name,) in session.query(AiPrompt.name).filter(AiPrompt.user_id == user_id)
    }
    for prompt_name, file_name in DEFAULT_AI_PROMPTS:
        if prompt_name in existing:
            continue
        session.add(
            AiPrompt(
                user_id=user_id,
                name=prompt_name,
                content=_read_prompt_text(file_name),
            )
        )


class DatabaseManager:
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.engine = create_engine(database_url, echo=False, future=True)
        self.session_factory = sessionmaker(bind=self.engine, expire_on_commit=False, class_=Session)

    def create_schema(self) -> None:
        Base.metadata.create_all(self.engine)
        self._apply_sqlite_migrations()

    def session(self) -> Session:
        return self.session_factory()

    def ensure_parent_directory(self) -> None:
        if self.database_url.startswith("sqlite+pysqlite:///"):
            db_path = self.database_url.replace("sqlite+pysqlite:///", "", 1)
            Path(db_path).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)

    def _apply_sqlite_migrations(self) -> None:
        if not self.database_url.startswith("sqlite+pysqlite:///"):
            return

        with self.engine.begin() as conn:
            note_cols = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(notes)")}
            if "parent_note_id" not in note_cols:
                conn.exec_driver_sql("ALTER TABLE notes ADD COLUMN parent_note_id INTEGER")
            if "assigned_user_id" not in note_cols:
                conn.exec_driver_sql("ALTER TABLE notes ADD COLUMN assigned_user_id INTEGER")
            if "note_type" not in note_cols:
                conn.exec_driver_sql("ALTER TABLE notes ADD COLUMN note_type TEXT NOT NULL DEFAULT 'note'")
            if "visibility" not in note_cols:
                conn.exec_driver_sql("ALTER TABLE notes ADD COLUMN visibility TEXT NOT NULL DEFAULT 'team'")
            if "is_pinned" not in note_cols:
                conn.exec_driver_sql("ALTER TABLE notes ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0")
            if "milestone_date" not in note_cols:
                conn.exec_driver_sql("ALTER TABLE notes ADD COLUMN milestone_date DATETIME")
            if "due_date" not in note_cols:
                conn.exec_driver_sql("ALTER TABLE notes ADD COLUMN due_date DATETIME")
            if "is_milestone" not in note_cols:
                conn.exec_driver_sql("ALTER TABLE notes ADD COLUMN is_milestone INTEGER NOT NULL DEFAULT 0")
            if "is_archived" not in note_cols:
                conn.exec_driver_sql("ALTER TABLE notes ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0")
            if "completed_at" not in note_cols:
                conn.exec_driver_sql("ALTER TABLE notes ADD COLUMN completed_at DATETIME")
            if "is_user_archived" not in note_cols:
                conn.exec_driver_sql("ALTER TABLE notes ADD COLUMN is_user_archived INTEGER NOT NULL DEFAULT 0")

            project_cols = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(projects)")}
            if "milestone_date" not in project_cols:
                conn.exec_driver_sql("ALTER TABLE projects ADD COLUMN milestone_date DATETIME")
            if "is_user_archived" not in project_cols:
                conn.exec_driver_sql("ALTER TABLE projects ADD COLUMN is_user_archived INTEGER NOT NULL DEFAULT 0")

            todo_cols = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(todos)")}
            if "assigned_to_id" not in todo_cols:
                conn.exec_driver_sql("ALTER TABLE todos ADD COLUMN assigned_to_id INTEGER")

            user_cols = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(users)")}
            if "can_use_ai_functions" not in user_cols:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN can_use_ai_functions INTEGER NOT NULL DEFAULT 0")


def seed_defaults(session: Session) -> None:
    if session.query(User).count() == 0:
        salt, password_hash = hash_password("admin123")
        session.add(
            User(
                username="admin",
                full_name="Administrator",
                role="admin",
                can_manage_projects=True,
                can_manage_templates=True,
                can_manage_users=True,
                can_use_ai_functions=True,
                password_salt=salt,
                password_hash=password_hash,
            )
        )

    if session.query(Category).count() == 0:
        session.add_all(
            [
                Category(name="Meeting Notes", description="Besprechungen und Protokolle", color="#3b82f6"),
                Category(name="Misc", description="Allgemeine Notizen", color="#14b8a6"),
                Category(name="Aufgabe", description="To-dos und Arbeitsauftraege", color="#f97316"),
                Category(name="Update", description="Projekt-Updates", color="#22c55e"),
                Category(name="Kommentar", description="Diskussionsbeitraege", color="#60a5fa"),
                Category(name="Feedback", description="Rueckmeldungen", color="#f59e0b"),
                Category(name="Milestone", description="Wichtige Meilensteine", color="#0ea5e9"),
            ]
        )

    if session.query(Tag).count() == 0:
        session.add_all(
            [Tag(name="urgent", color="#ef4444"), Tag(name="blocked", color="#f59e0b"), Tag(name="release", color="#8b5cf6")]
        )

    if session.query(Template).count() == 0:
        meeting_template = Template(
            name="Meeting Notes",
            scope="note",
            content="# {{title}}\n\n## Ziel\n-\n\n## Teilnehmer\n-\n\n## Entscheidungen\n-\n\n## Nächste Schritte\n- [ ]",
        )
        task_template = Template(
            name="Todo Update",
            scope="todo",
            content="# {{title}}\n\n## Beschreibung\n\n## Done Criteria\n- [ ]",
        )
        session.add_all([meeting_template, task_template])

    if session.query(Project).count() == 0:
        owner = session.query(User).filter(User.username == "admin").one_or_none()
        session.add(
            Project(
                name="Beispielprojekt",
                description="Startprojekt fuer die erste Demo",
                owner_id=owner.id if owner else None,
            )
        )

    ai_enabled_users = list(session.query(User).filter(User.can_use_ai_functions.is_(True)))
    for user in ai_enabled_users:
        ensure_default_ai_prompts_for_user(session, user.id)
