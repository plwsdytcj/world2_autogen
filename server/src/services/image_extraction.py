from __future__ import annotations

from typing import Optional, List
from urllib.parse import urljoin, urlparse, parse_qs
from bs4 import BeautifulSoup
from logging_config import get_logger

logger = get_logger(__name__)


def _first_non_empty(values: list[Optional[str]]) -> Optional[str]:
    for v in values:
        if v and isinstance(v, str) and v.strip():
            return v.strip()
    return None


def extract_reference_image_url(html: str, page_url: str) -> Optional[str]:
    """Best-effort extraction of a page's representative image URL.

    Priority:
    1) OpenGraph / Twitter meta images
    2) Obvious content images (infobox/main/article)
    3) Any reasonable <img> on the page

    Returns an absolute URL when possible; filters out data: URIs and SVGs.
    """
    try:
        soup = BeautifulSoup(html, "lxml")

        # 1) Meta tags
        meta_candidates: list[str] = []
        for prop in ("og:image", "twitter:image", "og:image:url"):
            meta = soup.find("meta", attrs={"property": prop}) or soup.find(
                "meta", attrs={"name": prop}
            )
            if meta:
                content = meta.get("content")
                if content:
                    meta_candidates.append(content)
        if meta_candidates:
            url = _normalize_image_url(meta_candidates[0], page_url)
            if url:
                logger.debug(
                    f"[image_extraction] Meta image chosen for {page_url}: {url}"
                )
                return url

        # 2) Content images in common containers
        selectors = [
            "table.infobox img",
            "article img",
            "main img",
            "#content img",
            "#main img",
        ]
        for sel in selectors:
            img = soup.select_one(sel)
            if img and img.get("src"):
                url = _normalize_image_url(img.get("src"), page_url)  # type: ignore[arg-type]
                if url:
                    logger.debug(
                        f"[image_extraction] Content image chosen for {page_url}: {url}"
                    )
                    return url

        # 3) Any <img>
        for img in soup.find_all("img"):
            src = img.get("src")
            if not src:
                continue
            url = _normalize_image_url(src, page_url)
            if url:
                logger.debug(
                    f"[image_extraction] Fallback <img> chosen for {page_url}: {url}"
                )
                return url
    except Exception:
        return None
    return None


def _normalize_image_url(src: str, page_url: str) -> Optional[str]:
    if not src:
        return None
    s = src.strip()
    if s.startswith("data:"):
        return None
    if s.lower().endswith(".svg"):
        return None
    # Convert to absolute URL
    try:
        abs_url = urljoin(page_url, s)
        if not (abs_url.startswith("http://") or abs_url.startswith("https://")):
            return None

        # Basic heuristics to exclude non-image endpoints (directories, html pages)
        parsed = urlparse(abs_url)
        path = parsed.path.lower()
        if path.endswith("/"):
            logger.debug(f"[image_extraction] Rejecting non-file URL: {abs_url}")
            return None

        # Accept common image extensions
        image_exts = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".ico", ".tif", ".tiff")
        has_ext = any(path.endswith(ext) for ext in image_exts)

        # Accept fandom/wikia style .../filename.png/revision/latest?... where extension appears before '/revision'
        # by checking for an extension in the last path segment before '/revision'
        if not has_ext and "/revision" in path:
            base_part = path.split("/revision", 1)[0]
            has_ext = any(base_part.endswith(ext) for ext in image_exts)

        # Sometimes extension is indicated via query, e.g., ?format=png
        if not has_ext and parsed.query:
            q = parse_qs(parsed.query)
            fmt = (q.get("format") or q.get("fm") or q.get("ext") or [None])[0]
            if isinstance(fmt, str):
                has_ext = fmt.lower() in {e.lstrip('.') for e in image_exts}

        if not has_ext:
            logger.debug(f"[image_extraction] Rejecting URL without image extension: {abs_url}")
            return None

        return abs_url
    except Exception:
        return None
    return None


def extract_all_image_urls(html: str, page_url: str, limit: int = 12) -> List[str]:
    """Extract multiple plausible image URLs from the page, ordered by rough priority.

    The list is unique and absolute-URL-only, excludes data: and svg.
    """
    seen: set[str] = set()
    results: list[str] = []
    try:
        soup = BeautifulSoup(html, "lxml")

        def maybe_add(raw: Optional[str]):
            if not raw:
                return
            url = _normalize_image_url(raw, page_url)
            if not url or url in seen:
                return
            seen.add(url)
            results.append(url)

        # 1) Meta tags first
        for prop in ("og:image", "twitter:image", "og:image:url"):
            for meta in soup.find_all("meta", attrs={"property": prop}):
                maybe_add(meta.get("content"))
            for meta in soup.find_all("meta", attrs={"name": prop}):
                maybe_add(meta.get("content"))
            if len(results) >= limit:
                return results[:limit]

        # 2) Content images in common containers
        selectors = [
            "table.infobox img",
            "article img",
            "main img",
            "#content img",
            "#main img",
        ]
        for sel in selectors:
            for img in soup.select(sel):
                maybe_add(img.get("src"))
                if len(results) >= limit:
                    return results[:limit]

        # 3) Any other images
        for img in soup.find_all("img"):
            maybe_add(img.get("src"))
            if len(results) >= limit:
                break
    except Exception as e:
        logger.debug(
            f"[image_extraction] Failed to extract images from {page_url}: {e}"
        )
        return results[:limit]
    if results:
        shown = ", ".join(results[:3])
        logger.debug(
            f"[image_extraction] Extracted {len(results)} image urls for {page_url}. First: {shown}"
        )
    else:
        logger.debug(
            f"[image_extraction] No image urls extracted for {page_url}."
        )
    return results[:limit]
