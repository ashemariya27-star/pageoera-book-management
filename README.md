# Pageora

Pageora is a personal reading library built with **React**, **FastAPI**, and **PostgreSQL**. Track books, reading progress, favourites, ratings, and personal reviews in a responsive interface with warm and dark themes.

## Project folders

```text
sample_project_2/
├── backend/
│   ├── app/
│   │   ├── __init__.py       # Marks app as a Python package
│   │   ├── book_catalog.py   # Verifies book matches with Open Library
│   │   ├── database.py       # PostgreSQL connection and database sessions
│   │   ├── main.py           # FastAPI app and book API endpoints
│   │   ├── models.py         # Shape of the books table in PostgreSQL
│   │   └── schemas.py        # Checks incoming and outgoing API data
│   ├── .env.example          # Example database connection setting
│   └── requirements.txt      # Python libraries used by the backend
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # React screen, forms, search, and API calls
│   │   ├── main.jsx          # Starts the React application
│   │   └── styles.css        # Colors, layout, and responsive styling
│   ├── public/
│   │   └── pageora-icon.svg   # Custom Pageora browser-tab icon
│   ├── .env.example          # Example URL for the backend API
│   ├── index.html            # Browser page that hosts React
│   ├── package.json          # JavaScript libraries and commands
│   └── vite.config.js        # Vite development-server configuration
└── README.md                 # Setup instructions
```

## 1. Create the PostgreSQL database

Install and start PostgreSQL, then create a database named `sample_project_2`. In pgAdmin's Query Tool or `psql`, run:

```sql
CREATE DATABASE sample_project_2;
```

The connection example assumes PostgreSQL is on `localhost:5432`, the username is `postgres`, and its password is `root`. After copying the example file in the next step, replace `YOUR_PASSWORD` with `root` in `backend/.env`. If your PostgreSQL username or password is different, update the URL there. Never put your real password into application source code or commit your `.env` file.

The backend creates the `books` table the first time it starts. It does not create or change your PostgreSQL user or password.

## 2. Start the FastAPI backend

Open a terminal in VS Code and run:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python -m uvicorn app.main:app --reload
```

If PowerShell prevents environment activation, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in that terminal and activate again. Keep the backend terminal open. The API runs at `http://localhost:8000`; its interactive documentation is at `http://localhost:8000/docs`.

## 3. Start the React website

Open a **second** VS Code terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Open the localhost URL printed by Vite (usually `http://localhost:5173`).

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/books` | List books |
| `GET` | `/api/book-metadata?title=...&author=...` | Find a verified catalog cover |
| `POST` | `/api/books` | Add a book |
| `PATCH` | `/api/books/{id}` | Edit a book or change its reading status |
| `DELETE` | `/api/books/{id}` | Remove a book |
| `GET` | `/api/health` | Check the API and database connection |

Ratings must be from 1 to 5. A book's status is `To Read`, `Reading`, or `Read`. Page counts cannot be negative, and pages read cannot exceed the total page count.

## Automatically find a book cover

When adding or editing a book, enter its title and author. After both fields are entered, Pageora checks the Open Library catalog automatically. It only fills in a cover when the title and author closely match a catalog record; it also corrects the title/author to the catalog spelling. Genre, summary, and personal review remain under your control. You can review or edit the fields before saving.

This optional lookup requires an internet connection. If the catalog is unavailable or the match is uncertain, no catalog cover is added and you can enter details manually. Book covers are loaded from Open Library; if a cover is missing or unavailable, the website displays its illustrated fallback cover instead. Existing databases receive new columns for covers, progress, favourites, reviews, and reading dates automatically the next time the backend starts.

## Pageora features

- Search by book title or author and filter by reading status, genre, and minimum star rating.
- Track total pages and pages read. Progress is shown on the book card, and completing the last page marks the book as read.
- Keep personal star ratings, reading notes, and reviews.
- Mark favourites and browse the dedicated Favourites page.
- See a dashboard with your library totals, average rating, and a six-month completed-books chart.
- Switch between the warm cream theme and the optional dark theme. The choice is saved in this browser.

The `books` table includes the book details and optional cover, pages-read/total-pages, favourite, review, created date, and completed date fields. The automatic startup migration adds missing columns and keeps existing book records. Because older records did not store dates, the migration assigns them the date it first runs; future reading activity uses the actual saved completion dates.
