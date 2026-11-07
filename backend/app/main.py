from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from .book_catalog import find_book_metadata
from .models import Book
from .schemas import BookCreate, BookRead, BookUpdate


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    book_columns = {column["name"] for column in inspect(engine).get_columns("books")}
    columns_to_add = {
        "cover_url": "VARCHAR(500)",
        "source_url": "VARCHAR(500)",
        "total_pages": "INTEGER NOT NULL DEFAULT 0",
        "pages_read": "INTEGER NOT NULL DEFAULT 0",
        "favorite": "BOOLEAN NOT NULL DEFAULT FALSE",
        "review": "TEXT NOT NULL DEFAULT ''",
        "created_at": "TIMESTAMP WITH TIME ZONE",
        "completed_at": "TIMESTAMP WITH TIME ZONE",
    }
    with engine.begin() as connection:
        for column, definition in columns_to_add.items():
            if column not in book_columns:
                connection.execute(text(f"ALTER TABLE books ADD COLUMN {column} {definition}"))
        connection.execute(
            text("UPDATE books SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL")
        )
        connection.execute(text("ALTER TABLE books ALTER COLUMN created_at SET NOT NULL"))
        connection.execute(
            text(
                "UPDATE books SET completed_at = COALESCE(completed_at, created_at) "
                "WHERE status = 'Read'"
            )
        )
        connection.execute(text("ALTER TABLE books DROP CONSTRAINT IF EXISTS status_is_valid"))
        connection.execute(
            text(
                "ALTER TABLE books ADD CONSTRAINT status_is_valid "
                "CHECK (status IN ('To Read', 'Reading', 'Read'))"
            )
        )
        connection.execute(text("ALTER TABLE books DROP CONSTRAINT IF EXISTS pages_non_negative"))
        connection.execute(
            text(
                "ALTER TABLE books ADD CONSTRAINT pages_non_negative "
                "CHECK (pages_read >= 0 AND total_pages >= 0)"
            )
        )
        connection.execute(
            text("ALTER TABLE books DROP CONSTRAINT IF EXISTS pages_read_not_over_total")
        )
        connection.execute(
            text(
                "ALTER TABLE books ADD CONSTRAINT pages_read_not_over_total "
                "CHECK (total_pages = 0 OR pages_read <= total_pages)"
            )
        )
    yield


app = FastAPI(title="Pageora API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}


@app.get("/api/book-metadata")
def book_metadata(
    title: str = Query(min_length=2, max_length=200),
    author: str = Query(min_length=2, max_length=160),
):
    try:
        return find_book_metadata(title.strip(), author.strip())
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@app.get("/api/books", response_model=list[BookRead])
def list_books(db: Session = Depends(get_db)):
    return db.scalars(select(Book).order_by(Book.id.desc())).all()


@app.post("/api/books", response_model=BookRead, status_code=status.HTTP_201_CREATED)
def create_book(book_data: BookCreate, db: Session = Depends(get_db)):
    values = book_data.model_dump()
    if values["total_pages"] and values["pages_read"] > values["total_pages"]:
        raise HTTPException(status_code=422, detail="Pages read cannot exceed total pages.")
    now = datetime.now(timezone.utc)
    if values["total_pages"] and values["pages_read"] == values["total_pages"]:
        values["status"] = "Read"
    elif values["pages_read"] and values["status"] == "To Read":
        values["status"] = "Reading"
    if values["status"] == "Read" and values["total_pages"]:
        values["pages_read"] = values["total_pages"]
    book = Book(
        **values,
        created_at=now,
        completed_at=now if values["status"] == "Read" else None,
    )
    db.add(book)
    db.commit()
    db.refresh(book)
    return book


@app.patch("/api/books/{book_id}", response_model=BookRead)
def update_book(book_id: int, book_data: BookUpdate, db: Session = Depends(get_db)):
    book = db.get(Book, book_id)
    if book is None:
        raise HTTPException(status_code=404, detail="Book not found.")

    updates = book_data.model_dump(exclude_unset=True)
    total_pages = updates.get("total_pages", book.total_pages)
    pages_read = updates.get("pages_read", book.pages_read)
    if total_pages and pages_read > total_pages:
        raise HTTPException(status_code=422, detail="Pages read cannot exceed total pages.")

    next_status = updates.get("status", book.status)
    if "status" in updates:
        if next_status == "Read":
            if total_pages:
                updates["pages_read"] = total_pages
            updates["completed_at"] = book.completed_at or datetime.now(timezone.utc)
        else:
            updates["completed_at"] = None
    elif total_pages and pages_read == total_pages:
        updates["status"] = "Read"
        updates["completed_at"] = book.completed_at or datetime.now(timezone.utc)
    elif "pages_read" in updates:
        if pages_read > 0:
            updates["status"] = "Reading"
            updates["completed_at"] = None
        elif book.status in {"Reading", "Read"}:
            updates["status"] = "To Read"
            updates["completed_at"] = None
    elif "total_pages" in updates and total_pages and pages_read < total_pages and book.status == "Read":
        updates["status"] = "Reading" if pages_read else "To Read"
        updates["completed_at"] = None

    for field, value in updates.items():
        setattr(book, field, value)

    db.commit()
    db.refresh(book)
    return book


@app.delete("/api/books/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_book(book_id: int, db: Session = Depends(get_db)):
    book = db.get(Book, book_id)
    if book is None:
        raise HTTPException(status_code=404, detail="Book not found.")

    db.delete(book)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
