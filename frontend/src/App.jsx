import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookHeart,
  BookMarked,
  BookOpen,
  ChartNoAxesColumnIncreasing,
  Check,
  ChevronDown,
  CircleHelp,
  Heart,
  House,
  Library,
  ListChecks,
  Moon,
  Pencil,
  Plus,
  Search,
  Settings,
  Sparkles,
  Star,
  Sun,
  Trash2,
  X,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const EMPTY_FORM = {
  title: "",
  author: "",
  genre: "General",
  rating: "5",
  summary: "",
  status: "To Read",
  cover_url: null,
  source_url: null,
  total_pages: "",
  pages_read: "0",
  favorite: false,
  review: "",
};
const GENRES = ["Fiction", "Fantasy", "Mystery", "Romance", "Non-fiction", "Science fiction", "Biography", "General"];
const NAV_ITEMS = [
  { label: "Dashboard", icon: House },
  { label: "My Books", icon: Library },
  { label: "Reading List", icon: ListChecks },
  { label: "Favourites", icon: Heart },
  { label: "Settings", icon: Settings },
];

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const error = await response.json();
      message = Array.isArray(error.detail)
        ? error.detail.map((item) => item.msg).join(" ")
        : error.detail || message;
    } catch {
      // Keep the HTTP status message when the server does not return JSON.
    }
    throw new Error(message);
  }
  return response.status === 204 ? null : response.json();
}

function App() {
  const [books, setBooks] = useState([]);
  const [activeSection, setActiveSection] = useState("Dashboard");
  const [statusFilter, setStatusFilter] = useState("All");
  const [genreFilter, setGenreFilter] = useState("All genres");
  const [ratingFilter, setRatingFilter] = useState("Any rating");
  const [search, setSearch] = useState("");
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("pageora-theme") === "dark");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [lookupMessage, setLookupMessage] = useState("");
  const [lookupAttempt, setLookupAttempt] = useState(0);
  const attemptedLookups = useRef(new Set());

  async function loadBooks() {
    setLoading(true);
    setError("");
    try {
      setBooks(await request("/books"));
    } catch (loadError) {
      setError(`${loadError.message} Make sure the API and PostgreSQL are running.`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBooks();
  }, []);

  useEffect(() => {
    localStorage.setItem("pageora-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const completedCount = books.filter((book) => book.status === "Read").length;
  const readingCount = books.filter((book) => book.status === "Reading").length;
  const toReadCount = books.filter((book) => book.status === "To Read").length;
  const favoriteCount = books.filter((book) => book.favorite).length;
  const genreOptions = [...new Set(books.map((book) => book.genre))].sort((a, b) => a.localeCompare(b));

  const visibleBooks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return books.filter((book) => {
      const matchesSection =
        activeSection === "Favourites"
          ? book.favorite
          : activeSection === "Reading List"
            ? book.status !== "Read"
            : true;
      const matchesStatus = statusFilter === "All" || book.status === statusFilter;
      const matchesGenre = genreFilter === "All genres" || book.genre === genreFilter;
      const matchesRating = ratingFilter === "Any rating" || book.rating >= Number(ratingFilter);
      const matchesSearch = !query || [book.title, book.author].some((value) => value.toLocaleLowerCase().includes(query));
      return matchesSection && matchesStatus && matchesGenre && matchesRating && matchesSearch;
    });
  }, [activeSection, books, genreFilter, ratingFilter, search, statusFilter]);

  const recentBooks = useMemo(
    () => [...books].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3),
    [books],
  );
  const monthlyActivity = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const month = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      const count = books.filter((book) => {
        if (!book.completed_at) return false;
        const completed = new Date(book.completed_at);
        return completed.getFullYear() === month.getFullYear() && completed.getMonth() === month.getMonth();
      }).length;
      return { label: month.toLocaleDateString(undefined, { month: "short" }), count };
    });
  }, [books]);
  const maxActivity = Math.max(1, ...monthlyActivity.map((item) => item.count));

  function resetLookup() {
    attemptedLookups.current.clear();
    setLookupLoading(false);
    setLookupError("");
    setLookupMessage("");
  }

  function openAddModal() {
    resetLookup();
    setEditingBook(null);
    setForm({ ...EMPTY_FORM });
    setError("");
    setModalOpen(true);
  }

  function openEditModal(book) {
    resetLookup();
    setEditingBook(book);
    setForm({
      title: book.title,
      author: book.author,
      genre: book.genre,
      rating: String(book.rating),
      summary: book.summary,
      status: book.status,
      cover_url: book.cover_url || null,
      source_url: book.source_url || null,
      total_pages: book.total_pages ? String(book.total_pages) : "",
      pages_read: String(book.pages_read || 0),
      favorite: book.favorite,
      review: book.review || "",
    });
    setError("");
    setModalOpen(true);
  }

  useEffect(() => {
    if (!modalOpen) return undefined;
    const title = form.title.trim();
    const author = form.author.trim();
    if (title.length < 2 || author.length < 2) return undefined;

    const key = `${title.toLocaleLowerCase()}|${author.toLocaleLowerCase()}`;
    if (attemptedLookups.current.has(key)) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLookupLoading(true);
      setLookupError("");
      setLookupMessage("");
      try {
        const params = new URLSearchParams({ title, author });
        const metadata = await request(`/book-metadata?${params}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        attemptedLookups.current.add(key);
        if (!metadata.matched) {
          setLookupMessage("We could not confirm this exact title and author, so no cover was added. Check spelling or continue manually.");
          return;
        }
        attemptedLookups.current.add(`${metadata.title.toLocaleLowerCase()}|${metadata.author.toLocaleLowerCase()}`);
        setForm((current) => ({
          ...current,
          title: metadata.title.slice(0, 200),
          author: metadata.author.slice(0, 160),
          cover_url: metadata.cover_url || null,
          source_url: metadata.source_url || null,
        }));
        setLookupMessage(metadata.cover_url
          ? "Verified title and author. The matching cover is ready; your notes and genre are unchanged."
          : "Verified title and author. No cover was available, so your notes and genre are unchanged.");
      } catch (lookupFailure) {
        if (!controller.signal.aborted) {
          attemptedLookups.current.add(key);
          setLookupError(`${lookupFailure.message} You can continue manually or retry.`);
        }
      } finally {
        if (!controller.signal.aborted) setLookupLoading(false);
      }
    }, 650);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [modalOpen, form.title, form.author, lookupAttempt]);

  function retryLookup() {
    attemptedLookups.current.delete(`${form.title.trim().toLocaleLowerCase()}|${form.author.trim().toLocaleLowerCase()}`);
    setLookupError("");
    setLookupMessage("");
    setLookupAttempt((value) => value + 1);
  }

  async function saveBook(event) {
    event.preventDefault();
    const totalPages = Number(form.total_pages) || 0;
    const pagesRead = Number(form.pages_read) || 0;
    if (totalPages && pagesRead > totalPages) {
      setError("Pages read cannot be greater than the total number of pages.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      rating: Number(form.rating),
      genre: form.genre.trim() || "General",
      total_pages: totalPages,
      pages_read: pagesRead,
    };
    try {
      const saved = editingBook
        ? await request(`/books/${editingBook.id}`, { method: "PATCH", body: JSON.stringify(payload) })
        : await request("/books", { method: "POST", body: JSON.stringify(payload) });
      setBooks((current) =>
        editingBook
          ? current.map((book) => (book.id === saved.id ? saved : book))
          : [saved, ...current],
      );
      setModalOpen(false);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateBook(book, updates) {
    try {
      const updated = await request(`/books/${book.id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      setBooks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      return updated;
    } catch (updateError) {
      setError(updateError.message);
      return null;
    }
  }

  async function toggleRead(book) {
    const nextStatus =
      book.status === "Read" ? "To Read" : book.status === "Reading" ? "Read" : "Reading";
    await updateBook(book, { status: nextStatus });
  }

  async function removeBook(book) {
    if (!window.confirm(`Remove "${book.title}" from your book list?`)) return;
    try {
      await request(`/books/${book.id}`, { method: "DELETE" });
      setBooks((current) => current.filter((item) => item.id !== book.id));
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  function navigate(section) {
    setActiveSection(section);
    setStatusFilter("All");
    setSearch("");
    setGenreFilter("All genres");
    setRatingFilter("Any rating");
  }

  const titles = {
    Dashboard: ["Good to see you, Reader!", "Your personal reading space."],
    "My Books": ["My Books", "Every book you have collected, all in one place."],
    "Reading List": ["Reading List", "The stories waiting for you and the ones in progress."],
    Favourites: ["Favourites", "The books closest to your heart."],
    Settings: ["Settings", "Make Pageora feel like your own."],
  };
  const isLibraryView = ["My Books", "Reading List", "Favourites"].includes(activeSection);

  return (
    <div className={`app-shell ${darkMode ? "theme-dark" : ""}`}>
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); navigate("Dashboard"); }} aria-label="Pageora dashboard">
          <span className="brand-icon"><BookOpen size={22} strokeWidth={2.2} /></span>
          <span>Pageora</span>
        </a>
        <p className="sidebar-tagline">Every book has a place.</p>
        <p className="nav-heading">YOUR LIBRARY</p>
        <nav className="side-nav" aria-label="Main navigation">
          {NAV_ITEMS.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-link ${activeSection === label ? "selected" : ""}`} onClick={() => navigate(label)}>
              <Icon size={17} />
              <span>{label}</span>
              {label === "Favourites" && favoriteCount > 0 && <span className="nav-count">{favoriteCount}</span>}
            </button>
          ))}
          <button className="nav-link nav-add" onClick={openAddModal}><Plus size={17} /><span>Add a book</span></button>
        </nav>
        <div className="sidebar-note">
          <BookHeart size={20} />
          <strong>A little reading goes a long way.</strong>
          <span>Keep track of the stories that stay with you.</span>
        </div>
        <button className="theme-toggle sidebar-theme" onClick={() => setDarkMode((value) => !value)}>
          {darkMode ? <Sun size={17} /> : <Moon size={17} />}
          <span>{darkMode ? "Switch to light mode" : "Switch to dark mode"}</span>
        </button>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-caption"><span className="online-dot" /> YOUR PERSONAL LIBRARY</div>
          <div className="topbar-right">
            <span className="reader-pill"><Library size={15} /> My bookshelf</span>
            <span className="avatar">P</span>
          </div>
        </header>
        <main className="main-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow"><Sparkles size={14} /> PAGEORA READING ROOM</p>
              <h1>{titles[activeSection][0]}</h1>
              <p className="welcome-copy">{titles[activeSection][1]}</p>
            </div>
            {activeSection !== "Settings" && (
              <button className="primary-button add-book-top" onClick={openAddModal}>
                <Plus size={18} /> Add a book
              </button>
            )}
          </section>

          {error && !modalOpen && (
            <div className="error-banner" role="alert">
              <CircleHelp size={18} /><span>{error}</span><button onClick={loadBooks}>Try again</button>
            </div>
          )}

          {activeSection === "Settings" ? (
            <section className="settings-card">
              <div className="settings-icon">{darkMode ? <Moon /> : <Sun />}</div>
              <div><h2>Appearance</h2><p>Choose the colour theme for your reading room.</p></div>
              <button className="secondary-button" onClick={() => setDarkMode((value) => !value)}>
                {darkMode ? <Sun size={17} /> : <Moon size={17} />}
                {darkMode ? "Use warm light theme" : "Use dark theme"}
              </button>
              <p className="settings-footnote">Your preference is saved in this browser.</p>
            </section>
          ) : activeSection === "Dashboard" ? (
            <Dashboard
              books={books}
              loading={loading}
              completedCount={completedCount}
              readingCount={readingCount}
              toReadCount={toReadCount}
              favoriteCount={favoriteCount}
              monthlyActivity={monthlyActivity}
              maxActivity={maxActivity}
              onOpenBooks={() => navigate("My Books")}
              onAdd={openAddModal}
              onEdit={openEditModal}
              onDelete={removeBook}
              onToggle={toggleRead}
              onFavorite={(book) => updateBook(book, { favorite: !book.favorite })}
            />
          ) : (
            <LibraryView
              books={visibleBooks}
              allBooks={books}
              activeSection={activeSection}
              loading={loading}
              search={search}
              setSearch={setSearch}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              genreFilter={genreFilter}
              setGenreFilter={setGenreFilter}
              ratingFilter={ratingFilter}
              setRatingFilter={setRatingFilter}
              genreOptions={genreOptions}
              completedCount={completedCount}
              readingCount={readingCount}
              toReadCount={toReadCount}
              onEdit={openEditModal}
              onDelete={removeBook}
              onToggle={toggleRead}
              onFavorite={(book) => updateBook(book, { favorite: !book.favorite })}
              onAdd={openAddModal}
            />
          )}
          <footer className="shelf-footer"><BookOpen size={15} /> Pageora · Your little corner of stories</footer>
        </main>
      </div>

      {modalOpen && (
        <BookModal
          editingBook={editingBook}
          form={form}
          setForm={setForm}
          error={error}
          saving={saving}
          lookupLoading={lookupLoading}
          lookupError={lookupError}
          lookupMessage={lookupMessage}
          onRetry={retryLookup}
          onClose={() => setModalOpen(false)}
          onSave={saveBook}
        />
      )}
    </div>
  );
}

function Dashboard({
  books, loading, completedCount, readingCount, toReadCount, favoriteCount,
  monthlyActivity, maxActivity, onOpenBooks, onAdd, onEdit, onDelete, onToggle, onFavorite,
}) {
  const recentBooks = [...books].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3);
  return (
    <>
      <section className="stats-grid" aria-label="Reading statistics">
        <StatCard icon={<Library />} number={books.length} label="TOTAL BOOKS" tone="terracotta" />
        <StatCard icon={<BookOpen />} number={readingCount} label="CURRENTLY READING" tone="sage" />
        <StatCard icon={<Check />} number={completedCount} label="COMPLETED" tone="cream" />
        <StatCard icon={<Star />} number={averageRating(books)} label="AVERAGE RATING" tone="rose" />
        <StatCard icon={<Heart />} number={favoriteCount} label="FAVOURITES" tone="sage" />
      </section>

      <section className="dashboard-grid">
        <div className="panel activity-panel">
          <div className="panel-heading">
            <div><h2><ChartNoAxesColumnIncreasing size={19} /> Reading activity</h2><p>Books finished each month</p></div>
            <span className="panel-badge">LAST 6 MONTHS</span>
          </div>
          <div className="activity-chart" role="img" aria-label="Monthly books completed">
            {monthlyActivity.map((item) => (
              <div className="activity-column" key={item.label}>
                <span className="activity-count">{item.count || ""}</span>
                <div className="activity-bar-track">
                  <div className="activity-bar" style={{ height: `${Math.max(item.count ? 16 : 5, (item.count / maxActivity) * 100)}%` }} />
                </div>
                <span className="activity-month">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel reading-goal-panel">
          <div className="panel-heading"><div><h2>Reading shelf</h2><p>Your collection at a glance.</p></div><BookHeart size={19} /></div>
          <div className="goal-number">{books.length}<span> books</span></div>
          <div className="goal-progress"><span style={{ width: `${books.length ? Math.min(100, (completedCount / books.length) * 100) : 0}%` }} /></div>
          <div className="goal-caption"><span>{completedCount} finished</span><span>{toReadCount} to read</span></div>
          <button className="secondary-button full-button" onClick={onOpenBooks}><Library size={16} /> Explore my books</button>
        </div>
      </section>

      <section className="panel recent-panel">
        <div className="panel-heading">
          <div><h2><BookMarked size={19} /> Recently added</h2><p>Your latest additions to the shelf.</p></div>
          <button className="text-button" onClick={onOpenBooks}>View all <span>→</span></button>
        </div>
        {loading ? <div className="loading-line">Opening your bookshelf…</div> : recentBooks.length ? (
          <div className="book-grid recent-grid">
            {recentBooks.map((book, index) => (
              <BookCard key={book.id} book={book} index={index} onEdit={() => onEdit(book)} onDelete={() => onDelete(book)} onToggle={() => onToggle(book)} onFavorite={() => onFavorite(book)} />
            ))}
          </div>
        ) : (
          <div className="dashboard-empty"><BookOpen size={24} /><span>Your reading shelf is ready for its first story.</span><button className="primary-button" onClick={onAdd}><Plus size={16} /> Add a book</button></div>
        )}
      </section>
    </>
  );
}

function LibraryView({
  books, allBooks, activeSection, loading, search, setSearch, statusFilter, setStatusFilter,
  genreFilter, setGenreFilter, ratingFilter, setRatingFilter, genreOptions, completedCount,
  readingCount, toReadCount, onEdit, onDelete, onToggle, onFavorite, onAdd,
}) {
  const tabs = [
    { label: "All", count: allBooks.length },
    { label: "To Read", count: toReadCount },
    { label: "Reading", count: readingCount },
    { label: "Read", count: completedCount },
  ];
  return (
    <section className="shelf-section panel">
      <div className="section-heading">
        <div><h2><Library size={19} /> {activeSection === "Favourites" ? "Loved books" : activeSection === "Reading List" ? "Your reading list" : "Your bookshelf"}</h2><p>{books.length} {books.length === 1 ? "book" : "books"} shown</p></div>
        <button className="quiet-button" onClick={onAdd}><Plus size={16} /> Add book</button>
      </div>
      <div className="toolbar">
        <label className="search-box">
          <Search size={17} />
          <input type="search" placeholder="Search by title or author..." value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search books" />
          {search && <button className="clear-search" onClick={() => setSearch("")} aria-label="Clear search"><X size={15} /></button>}
        </label>
        <div className="filter-controls">
          <label className="filter-select-label">Genre
            <span className="filter-select-wrap"><select value={genreFilter} onChange={(event) => setGenreFilter(event.target.value)} aria-label="Filter by genre"><option>All genres</option>{genreOptions.map((genre) => <option key={genre}>{genre}</option>)}</select><ChevronDown size={14} /></span>
          </label>
          <label className="filter-select-label">Rating
            <span className="filter-select-wrap"><select value={ratingFilter} onChange={(event) => setRatingFilter(event.target.value)} aria-label="Filter by minimum rating"><option>Any rating</option><option value="5">5 stars</option><option value="4">4+ stars</option><option value="3">3+ stars</option><option value="2">2+ stars</option></select><ChevronDown size={14} /></span>
          </label>
        </div>
      </div>
      {activeSection === "My Books" && (
        <div className="filter-tabs" role="tablist" aria-label="Filter by reading status">
          {tabs.map((tab) => <button key={tab.label} className={`filter-tab ${statusFilter === tab.label ? "active" : ""}`} onClick={() => setStatusFilter(tab.label)} role="tab" aria-selected={statusFilter === tab.label}>{tab.label}<span>{tab.count}</span></button>)}
        </div>
      )}
      {loading ? <div className="empty-state"><div className="empty-icon"><BookOpen /></div><h3>Opening your bookshelf…</h3></div> : books.length ? (
        <div className="book-grid">
          {books.map((book, index) => <BookCard key={book.id} book={book} index={index} onEdit={() => onEdit(book)} onDelete={() => onDelete(book)} onToggle={() => onToggle(book)} onFavorite={() => onFavorite(book)} />)}
        </div>
      ) : (
        <div className="empty-state"><div className="empty-icon"><BookOpen size={28} /></div><h3>{search || genreFilter !== "All genres" || ratingFilter !== "Any rating" ? "No books match those filters" : activeSection === "Favourites" ? "No favourites yet" : "Your shelf is a blank page"}</h3><p>Try changing a filter, or add a book to your collection.</p><button className="primary-button" onClick={onAdd}><Plus size={16} /> Add a book</button></div>
      )}
    </section>
  );
}

function BookModal({ editingBook, form, setForm, error, saving, lookupLoading, lookupError, lookupMessage, onRetry, onClose, onSave }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="book-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header"><div><p className="eyebrow">YOUR PAGEORA SHELF</p><h2 id="modal-title">{editingBook ? "Edit this book" : "Add a new book"}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button></div>
        <form onSubmit={onSave}>
          <label className="form-field"><span>Book title <b>*</b></span><input required maxLength={200} autoFocus placeholder="e.g. The Midnight Library" value={form.title} onChange={(event) => { setForm((current) => ({ ...current, title: event.target.value, cover_url: null, source_url: null })); }} /></label>
          <p className="catalog-hint">Enter a title and author to automatically check for a verified book cover.</p>
          {lookupLoading && <p className="catalog-message" role="status">Checking the title and author…</p>}
          {lookupMessage && <p className="catalog-message" role="status">{lookupMessage}{form.source_url && <> <a href={form.source_url} target="_blank" rel="noreferrer">Catalog record</a>.</>}</p>}
          {lookupError && <p className="catalog-message catalog-error" role="alert">{lookupError} <button type="button" className="catalog-retry" onClick={onRetry}>Try again</button></p>}
          <label className="form-field"><span>Author <b>*</b></span><input required maxLength={160} placeholder="e.g. Matt Haig" value={form.author} onChange={(event) => { setForm((current) => ({ ...current, author: event.target.value, cover_url: null, source_url: null })); }} /></label>
          <div className="form-row">
            <label className="form-field"><span>Genre</span><span className="select-wrap"><select value={GENRES.includes(form.genre) ? form.genre : "Other"} onChange={(event) => setForm((current) => ({ ...current, genre: event.target.value === "Other" ? "" : event.target.value }))}>{GENRES.map((genre) => <option key={genre}>{genre}</option>)}<option value="Other">Other / type below</option></select><ChevronDown size={16} /></span>{(!GENRES.includes(form.genre) || form.genre === "") && <input className="genre-custom" maxLength={80} placeholder="Enter a genre" value={form.genre} onChange={(event) => setForm((current) => ({ ...current, genre: event.target.value }))} />}</label>
            <label className="form-field"><span>Your rating</span><span className="select-wrap rating-select"><select value={form.rating} onChange={(event) => setForm((current) => ({ ...current, rating: event.target.value }))}>{[5, 4, 3, 2, 1].map((rating) => <option value={rating} key={rating}>{rating} {rating === 1 ? "star" : "stars"}</option>)}</select><Star size={15} className="select-star" /><ChevronDown size={16} /></span></label>
          </div>
          <div className="form-row page-fields">
            <label className="form-field"><span>Total pages</span><input type="number" min="0" max="100000" placeholder="e.g. 320" value={form.total_pages} onChange={(event) => setForm((current) => ({ ...current, total_pages: event.target.value }))} /></label>
            <label className="form-field"><span>Pages read</span><input type="number" min="0" max={form.total_pages || 100000} placeholder="0" value={form.pages_read} onChange={(event) => setForm((current) => ({ ...current, pages_read: event.target.value }))} /></label>
          </div>
          <label className="form-field"><span>Reading status</span><span className="select-wrap"><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option>To Read</option><option>Reading</option><option>Read</option></select><ChevronDown size={16} /></span></label>
          <label className="form-field"><span>Short summary <small>Your own notes</small></span><textarea maxLength={2000} rows={3} placeholder="Write a short reminder about this book…" value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} /></label>
          <label className="form-field"><span>Personal review <small>Optional</small></span><textarea maxLength={5000} rows={3} placeholder="What did you think of it? Your private reading notes…" value={form.review} onChange={(event) => setForm((current) => ({ ...current, review: event.target.value }))} /></label>
          <label className="favorite-check"><input type="checkbox" checked={form.favorite} onChange={(event) => setForm((current) => ({ ...current, favorite: event.target.checked }))} /><Heart size={16} /> Add to favourites</label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : editingBook ? "Save changes" : <><Plus size={17} /> Add to shelf</>}</button></div>
        </form>
      </section>
    </div>
  );
}

function StatCard({ icon, number, label, tone }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div><strong>{number}</strong><span>{label}</span></div></div>;
}

function BookCard({ book, index, onEdit, onDelete, onToggle, onFavorite }) {
  const coverStyles = ["cover-lilac", "cover-blue", "cover-peach", "cover-green", "cover-rose"];
  const [failedCoverUrl, setFailedCoverUrl] = useState(null);
  const showCatalogCover = book.cover_url && failedCoverUrl !== book.cover_url;
  const progress = book.total_pages ? Math.round((book.pages_read / book.total_pages) * 100) : 0;
  return (
    <article className="book-card">
      {showCatalogCover ? <div className="book-cover-image"><img src={book.cover_url} alt={`Cover of ${book.title}`} onError={() => setFailedCoverUrl(book.cover_url)} /></div> : (
        <div className={`book-cover ${coverStyles[(book.id + index) % coverStyles.length]}`}><div className="cover-topline"><span>PAGEORA · {String(book.id).padStart(2, "0")}</span><BookOpen size={16} /></div><div className="cover-art"><span>{book.title.slice(0, 1).toUpperCase()}</span></div><div className="cover-title">{book.title}</div><div className="cover-author">{book.author}</div><div className="cover-bottomline">{book.genre.toUpperCase()}</div></div>
      )}
      <div className="book-info">
        <div className="book-heading"><div><span className="genre-label">{book.genre}</span><h3 title={book.title}>{book.title}</h3><p className="author-line">by {book.author}</p></div><div className="book-actions"><button className={`icon-button favorite-button ${book.favorite ? "is-favorite" : ""}`} onClick={onFavorite} aria-label={book.favorite ? `Remove ${book.title} from favourites` : `Add ${book.title} to favourites`} title="Favourite"><Heart size={16} fill={book.favorite ? "currentColor" : "none"} /></button><button className="icon-button" onClick={onEdit} aria-label={`Edit ${book.title}`} title="Edit"><Pencil size={15} /></button><button className="icon-button danger-hover" onClick={onDelete} aria-label={`Delete ${book.title}`} title="Delete"><Trash2 size={15} /></button></div></div>
        <div className="book-rating" aria-label={`${book.rating} out of 5 stars`}><span className="stars">{Array.from({ length: 5 }, (_, i) => <Star size={14} key={i} fill={i < book.rating ? "currentColor" : "none"} />)}</span><span>{book.rating}.0</span></div>
        {book.summary && <p className="book-summary">{book.summary}</p>}
        {book.review && <blockquote className="book-review">“{book.review}”</blockquote>}
        {book.source_url && <a className="book-source" href={book.source_url} target="_blank" rel="noreferrer">Details: Open Library</a>}
        {book.total_pages > 0 && <div className="book-progress"><div className="progress-caption"><span>{book.pages_read} / {book.total_pages} pages</span><strong>{progress}%</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div></div>}
        <button className={`status-button ${book.status === "Read" ? "is-read" : ""}`} onClick={onToggle}>{book.status === "Read" ? <><Check size={14} /> Finished</> : book.status === "Reading" ? <><BookOpen size={14} /> Mark finished</> : <><BookOpen size={14} /> Start reading</>}</button>
      </div>
    </article>
  );
}

function averageRating(books) {
  return books.length ? (books.reduce((total, book) => total + book.rating, 0) / books.length).toFixed(1) : "0.0";
}

export default App;
