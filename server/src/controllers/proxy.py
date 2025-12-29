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

        headers = {
            "User-Agent": "lorecard/2.5 (+image-proxy)",
            "Accept": "image/*,*/*;q=0.8",
        }

        max_bytes = 5 * 1024 * 1024  # 5MB
        try:
            async with httpx.AsyncClient(follow_redirects=True, headers=headers) as client:
                r = await client.get(url, timeout=10.0)
                r.raise_for_status()
                ctype = r.headers.get("Content-Type", "")
                if not ctype.startswith("image/"):
                    raise HTTPException(status_code=415, detail=f"Upstream not image: {ctype}")
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

