from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


BookStatus = Literal["To Read", "Reading", "Read"]


class BookCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    author: str = Field(min_length=1, max_length=160)
    genre: str = Field(default="General", min_length=1, max_length=80)
    rating: int = Field(ge=1, le=5)
    summary: str = Field(default="", max_length=2000)
    status: BookStatus = "To Read"
    cover_url: str | None = Field(default=None, max_length=500)
    source_url: str | None = Field(default=None, max_length=500)
    total_pages: int = Field(default=0, ge=0, le=100000)
    pages_read: int = Field(default=0, ge=0, le=100000)
    favorite: bool = False
    review: str = Field(default="", max_length=5000)

    @field_validator("title", "author", "genre")
    @classmethod
    def remove_extra_spaces(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("This field cannot be blank.")
        return cleaned


class BookUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    author: str | None = Field(default=None, min_length=1, max_length=160)
    genre: str | None = Field(default=None, min_length=1, max_length=80)
    rating: int | None = Field(default=None, ge=1, le=5)
    summary: str | None = Field(default=None, max_length=2000)
    status: BookStatus | None = None
    cover_url: str | None = Field(default=None, max_length=500)
    source_url: str | None = Field(default=None, max_length=500)
    total_pages: int | None = Field(default=None, ge=0, le=100000)
    pages_read: int | None = Field(default=None, ge=0, le=100000)
    favorite: bool | None = None
    review: str | None = Field(default=None, max_length=5000)

    @field_validator("title", "author", "genre")
    @classmethod
    def remove_extra_spaces(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("This field cannot be blank.")
        return cleaned


class BookRead(BookCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    completed_at: datetime | None
