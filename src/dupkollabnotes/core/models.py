from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Table, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


note_tags = Table(
    "note_tags",
    Base.metadata,
    Column("note_id", ForeignKey("notes.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

project_tags = Table(
    "project_tags",
    Base.metadata,
    Column("project_id", ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    role: Mapped[str] = mapped_column(String(32), default="member", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    can_manage_projects: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_manage_templates: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_manage_users: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    password_salt: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    password_hash: Mapped[str] = mapped_column(String(128), default="", nullable=False)

    notes: Mapped[list["Note"]] = relationship(back_populates="author", foreign_keys="Note.author_id")
    projects: Mapped[list["Project"]] = relationship(back_populates="owner")
    templates: Mapped[list["Template"]] = relationship(back_populates="creator")


class Category(Base, TimestampMixin):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    color: Mapped[str] = mapped_column(String(32), default="#3b82f6", nullable=False)

    notes: Mapped[list["Note"]] = relationship(back_populates="category")
    templates: Mapped[list["Template"]] = relationship(back_populates="category")


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="active", nullable=False)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    milestone_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_user_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    owner: Mapped[User | None] = relationship(back_populates="projects")
    notes: Mapped[list["Note"]] = relationship(back_populates="project")
    todos: Mapped[list["TodoItem"]] = relationship(back_populates="project")
    updates: Mapped[list["UpdateItem"]] = relationship(back_populates="project")
    tags: Mapped[list["Tag"]] = relationship(secondary=project_tags, back_populates="projects")


class Tag(Base, TimestampMixin):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("name", name="uq_tags_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    color: Mapped[str] = mapped_column(String(32), default="#14b8a6", nullable=False)

    notes: Mapped[list["Note"]] = relationship(secondary=note_tags, back_populates="tags")
    projects: Mapped[list[Project]] = relationship(secondary=project_tags, back_populates="tags")


class Template(Base, TimestampMixin):
    __tablename__ = "templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), unique=True, nullable=False)
    scope: Mapped[str] = mapped_column(String(32), default="note", nullable=False)
    content: Mapped[str] = mapped_column(Text, default="", nullable=False)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    category: Mapped[Category | None] = relationship(back_populates="templates")
    creator: Mapped[User | None] = relationship(back_populates="templates")


class Note(Base, TimestampMixin):
    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, default="", nullable=False)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    template_id: Mapped[int | None] = mapped_column(ForeignKey("templates.id", ondelete="SET NULL"), nullable=True)
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    parent_note_id: Mapped[int | None] = mapped_column(ForeignKey("notes.id", ondelete="SET NULL"), nullable=True)
    assigned_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    note_type: Mapped[str] = mapped_column(String(32), default="note", nullable=False)
    visibility: Mapped[str] = mapped_column(String(32), default="team", nullable=False)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_milestone: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_user_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    milestone_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    category: Mapped[Category | None] = relationship(back_populates="notes")
    project: Mapped[Project | None] = relationship(back_populates="notes")
    template: Mapped[Template | None] = relationship()
    author: Mapped[User | None] = relationship(back_populates="notes", foreign_keys=[author_id])
    assigned_user: Mapped[User | None] = relationship(foreign_keys=[assigned_user_id])
    parent_note: Mapped["Note | None"] = relationship(remote_side=[id], back_populates="children")
    children: Mapped[list["Note"]] = relationship(back_populates="parent_note")
    tags: Mapped[list[Tag]] = relationship(secondary=note_tags, back_populates="notes")


class TodoItem(Base, TimestampMixin):
    __tablename__ = "todos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, default="", nullable=False)
    is_done: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    note_id: Mapped[int | None] = mapped_column(ForeignKey("notes.id", ondelete="SET NULL"), nullable=True)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_to_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    project: Mapped[Project | None] = relationship(back_populates="todos")


class UpdateItem(Base, TimestampMixin):
    __tablename__ = "updates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, default="", nullable=False)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    note_id: Mapped[int | None] = mapped_column(ForeignKey("notes.id", ondelete="SET NULL"), nullable=True)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    project: Mapped[Project | None] = relationship(back_populates="updates")
