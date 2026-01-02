from litestar import Controller, get
from litestar.response import Response
from litestar.exceptions import HTTPException
from urllib.parse import urlparse
import httpx
from logging_config import get_logger

logger = get_logger(__name__)


class ProxyController(Controller):
    path = "/proxy"

    @get("/image")
    async def image(self, url: str) -> Response:
        """Lightweight image proxy to mitigate hotlink/CORS issues in previews.

        Security constraints:
        - Only http/https schemes allowed
        - Timeout and max size enforced
        - Only content-type starting with image/ is forwarded
        """
        if not url:
            raise HTTPException(status_code=400, detail="Missing url")

        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            raise HTTPException(status_code=400, detail="Invalid scheme")

        # Special handling for Facebook CDN
        is_facebook_cdn = "fbcdn.net" in parsed.netloc or "facebook.com" in parsed.netloc
        
        base_headers = {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121 Safari/537.36 Lorecard/2.5",
            "Accept": "image/avif,image/webp,image/*,*/*;q=0.8",
        }
        
        # For Facebook CDN, use Facebook referer to avoid signature mismatch
        if is_facebook_cdn:
            base_headers["Referer"] = "https://www.facebook.com/"
        else:
            # Default referer: origin of the target URL.
            base_headers["Referer"] = f"{parsed.scheme}://{parsed.netloc}/"

        max_bytes = 5 * 1024 * 1024  # 5MB
        try:
            async with httpx.AsyncClient(follow_redirects=True) as client:
                # Attempt 1: with configured referer
                r = await client.get(url, timeout=10.0, headers=base_headers)
                
                # Special retry for Facebook CDN if signature mismatch
                if r.status_code in (403, 404) and is_facebook_cdn:
                    # Try with different referer patterns
                    for fb_referer in [
                        "https://www.facebook.com/",
                        "https://m.facebook.com/",
                        "https://www.facebook.com/profile.php",
                    ]:
                        headers_retry = dict(base_headers)
                        headers_retry["Referer"] = fb_referer
                        logger.debug(f"Facebook CDN retry with referer {fb_referer} for {url}")
                        r_retry = await client.get(url, timeout=10.0, headers=headers_retry)
                        if r_retry.status_code == 200:
                            r = r_retry
                            break
                
                # If blocked by fandom/static.wikia, retry with fandom referer derived from path
                if r.status_code in (401, 403) and parsed.netloc.endswith("nocookie.net"):
                    segs = [s for s in parsed.path.split("/") if s]
                    if segs:
                        fandom_referer = f"https://{segs[0]}.fandom.com/"
                        headers2 = dict(base_headers)
                        headers2["Referer"] = fandom_referer
                        logger.debug(
                            f"Proxy retry with fandom referer {fandom_referer} for {url}"
                        )
                        r = await client.get(url, timeout=10.0, headers=headers2)
                r.raise_for_status()
                ctype = r.headers.get("Content-Type", "") or ""
                if not (ctype.startswith("image/") or ctype == "application/octet-stream"):
                    # Fallback: guess from URL path extension
                    path = parsed.path.lower()
                    for ext, mime in (
                        (".png", "image/png"),
                        (".jpg", "image/jpeg"),
                        (".jpeg", "image/jpeg"),
                        (".webp", "image/webp"),
                        (".gif", "image/gif"),
                        (".bmp", "image/bmp"),
                        (".tif", "image/tiff"),
                        (".tiff", "image/tiff"),
                        (".ico", "image/x-icon"),
                    ):
                        if path.endswith(ext):
                            ctype = mime
                            break
                    if not ctype or not ctype.startswith("image/"):
                        raise HTTPException(status_code=415, detail=f"Upstream not image: {r.headers.get('Content-Type')}")
                content = r.content[: max_bytes + 1]
                if len(content) > max_bytes:
                    raise HTTPException(status_code=413, detail="Image too large")

                # Pass through a few headers and enable browser cache
                return Response(
                    content=content,
                    media_type=ctype,
                    headers={
                        "Cache-Control": "public, max-age=86400",  # 1 day
                    },
                )
        except httpx.HTTPStatusError as e:
            logger.warning(f"Image proxy upstream error {e.response.status_code} for {url}")
            raise HTTPException(status_code=e.response.status_code, detail="Upstream error")
        except Exception as e:
            logger.warning(f"Image proxy failed for {url}: {e}")
            raise HTTPException(status_code=502, detail="Image proxy failed")
