import json
import logging
import re
import unicodedata
from difflib import SequenceMatcher
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)


def _normalized(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()


def _fetch_json(url: str) -> dict:
    request = Request(
        url,
        headers={"User-Agent": "BookNook/1.0 (local educational project)"},
    )
    try:
        with urlopen(request, timeout=8) as response:
            return json.load(response)
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
        raise RuntimeError("The Open Library catalog could not be reached.") from error


def find_book_metadata(title: str, author: str) -> dict:
    params = urlencode(
        {
            "title": title,
            "fields": "key,title,author_name,cover_i,first_publish_year,number_of_pages_median",
            "limit": 50,
        }
    )
    results = _fetch_json(f"https://openlibrary.org/search.json?{params}")
    requested_title = _normalized(title)
    requested_author = _normalized(author)
    candidates = []

    for book in results.get("docs", []):
        found_title = book.get("title", "")
        title_score = SequenceMatcher(None, requested_title, _normalized(found_title)).ratio()
        if title_score < 0.95:
            continue

        authors = book.get("author_name") or []
        if not authors:
            continue
        author_score = max(
            SequenceMatcher(None, requested_author, _normalized(name)).ratio()
            for name in authors
        )
        if author_score < 0.88:
            continue

        candidates.append((author_score, book))

    if not candidates:
        return {"matched": False}

    candidates.sort(
        key=lambda item: (item[0], bool(item[1].get("cover_i"))),
        reverse=True,
    )
    best_author_score, match = candidates[0]
    if (
        len(candidates) > 1
        and candidates[1][0] >= best_author_score - 0.03
        and candidates[1][1].get("key") != match.get("key")
    ):
        return {"matched": False}

    work_key = match.get("key", "")
    if not re.fullmatch(r"/works/OL\d+W", work_key):
        logger.warning("Open Library returned an unexpected work key for a catalog match.")
        return {"matched": False}

    cover_id = match.get("cover_i")
    work = {}
    try:
        work = _fetch_json(f"https://openlibrary.org{work_key}.json")
        if not cover_id:
            covers = work.get("covers") or []
            cover_id = next((cover for cover in covers if isinstance(cover, int) and cover > 0), None)
    except RuntimeError:
        logger.warning("Could not retrieve Open Library work details for %s.", work_key)

    description = work.get("description", "")
    if isinstance(description, dict):
        description = description.get("value", "")
    if not isinstance(description, str):
        description = ""

    total_pages = match.get("number_of_pages_median")
    if not isinstance(total_pages, int) or isinstance(total_pages, bool) or total_pages < 1:
        total_pages = None

    published_year = match.get("first_publish_year")
    if not isinstance(published_year, int) or isinstance(published_year, bool):
        published_year = None

    return {
        "matched": True,
        "title": match["title"],
        "author": match["author_name"][0],
        "cover_url": f"https://covers.openlibrary.org/b/id/{cover_id}-M.jpg" if cover_id else None,
        "source_url": f"https://openlibrary.org{work_key}",
        "description": description.strip()[:2000],
        "total_pages": total_pages,
        "published_year": published_year,
    }


def find_genre_recommendations(genre: str, limit: int = 8) -> list[dict]:
    params = urlencode(
        {
            "subject": genre,
            "fields": "key,title,author_name,cover_i,first_publish_year",
            "limit": min(limit * 3, 40),
        }
    )
    results = _fetch_json(f"https://openlibrary.org/search.json?{params}")
    recommendations = []
    seen_titles = set()

    documents = results.get("docs", [])
    if not isinstance(documents, list):
        logger.warning("Open Library returned an unexpected recommendations result.")
        return recommendations

    for book in documents:
        if not isinstance(book, dict):
            continue
        work_key = book.get("key", "")
        title = book.get("title", "")
        authors = book.get("author_name") or []
        if (
            not isinstance(work_key, str)
            or not re.fullmatch(r"/works/OL\d+W", work_key)
            or not isinstance(title, str)
            or not title.strip()
            or not isinstance(authors, list)
            or not authors
            or not isinstance(authors[0], str)
            or not authors[0].strip()
        ):
            continue

        normalized_title = _normalized(title)
        if not normalized_title or normalized_title in seen_titles:
            continue
        seen_titles.add(normalized_title)

        cover_id = book.get("cover_i")
        cover_url = (
            f"https://covers.openlibrary.org/b/id/{cover_id}-M.jpg"
            if isinstance(cover_id, int) and not isinstance(cover_id, bool) and cover_id > 0
            else None
        )
        first_publish_year = book.get("first_publish_year")
        recommendations.append(
            {
                "title": title.strip()[:200],
                "author": authors[0].strip()[:160],
                "genre": genre,
                "cover_url": cover_url,
                "source_url": f"https://openlibrary.org{work_key}",
                "first_publish_year": (
                    first_publish_year
                    if isinstance(first_publish_year, int) and not isinstance(first_publish_year, bool)
                    else None
                ),
            }
        )
        if len(recommendations) == limit:
            break

    return recommendations
