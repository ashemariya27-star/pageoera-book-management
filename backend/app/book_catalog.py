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
            "fields": "key,title,author_name,cover_i",
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
    try:
        work = _fetch_json(f"https://openlibrary.org{work_key}.json")
        if not cover_id:
            covers = work.get("covers") or []
            cover_id = next((cover for cover in covers if isinstance(cover, int) and cover > 0), None)
    except RuntimeError:
        logger.warning("Could not retrieve Open Library work details for %s.", work_key)

    return {
        "matched": True,
        "title": match["title"],
        "author": match["author_name"][0],
        "cover_url": f"https://covers.openlibrary.org/b/id/{cover_id}-M.jpg" if cover_id else None,
        "source_url": f"https://openlibrary.org{work_key}",
    }
