from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class Book(Base):
    __tablename__ = "books"
    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="rating_between_one_and_five"),
        CheckConstraint("status IN ('To Read', 'Reading', 'Read')", name="status_is_valid"),
        CheckConstraint("pages_read >= 0 AND total_pages >= 0", name="pages_non_negative"),
        CheckConstraint(
            "total_pages = 0 OR pages_read <= total_pages",
            name="pages_read_not_over_total",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    author: Mapped[str] = mapped_column(String(160), nullable=False)
    genre: Mapped[str] = mapped_column(String(80), nullable=False, default="General")
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="To Read")
    cover_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    total_pages: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pages_read: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    favorite: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    review: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
