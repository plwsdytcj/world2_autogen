"""
Service for downloading and caching images from external URLs.
This is particularly useful for Facebook CDN images which have expiring signatures.
"""

import asyncio
import hashlib
import os
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse
import httpx
from logging_config import get_logger

logger = get_logger(__name__)

# Directory to store downloaded images
# Get the server directory (parent of src)
IMAGES_DIR = Path(os.path.abspath(__file__)).parent.parent.parent / "images"
IMAGES_DIR.mkdir(exist_ok=True)

# Base URL for serving downloaded images
IMAGES_BASE_URL = "/api/images"


def _get_image_filename(url: str) -> str:
    """Generate a filename for an image based on its URL."""
    # Use hash of URL to create unique filename
    url_hash = hashlib.md5(url.encode()).hexdigest()
    parsed = urlparse(url)
    path = parsed.path.lower()
    
    # Try to extract extension from URL
    ext = ".jpg"  # default
    for possible_ext in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
        if path.endswith(possible_ext):
            ext = possible_ext
            break
    
    return f"{url_hash}{ext}"


async def download_image(url: str, timeout: float = 10.0) -> Optional[str]:
    """
    Download an image from a URL and save it locally.
    
    Args:
        url: Image URL to download
        timeout: Request timeout in seconds
        
    Returns:
        Local file path relative to images directory, or None if download failed
    """
    if not url:
        return None
    
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            logger.warning(f"Invalid URL scheme for image download: {url}")
            return None
        
        # Check if already downloaded
        filename = _get_image_filename(url)
        local_path = IMAGES_DIR / filename
        if local_path.exists():
            logger.debug(f"Image already cached: {filename}")
            return filename
        
        # Download the image
        is_facebook_cdn = "fbcdn.net" in parsed.netloc or "facebook.com" in parsed.netloc
        
        headers = {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121 Safari/537.36",
            "Accept": "image/avif,image/webp,image/*,*/*;q=0.8",
        }
        
        # For Facebook CDN, use Facebook referer
        if is_facebook_cdn:
            headers["Referer"] = "https://www.facebook.com/"
        else:
            headers["Referer"] = f"{parsed.scheme}://{parsed.netloc}/"
        
        async with httpx.AsyncClient(follow_redirects=True, timeout=timeout) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            
            # Verify it's an image
            content_type = response.headers.get("Content-Type", "").lower()
            if not content_type.startswith("image/"):
                # Check file extension as fallback
                path = parsed.path.lower()
                if not any(path.endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".webp", ".gif"]):
                    logger.warning(f"Downloaded content is not an image: {content_type} for {url}")
                    return None
            
            # Save to local file
            max_size = 5 * 1024 * 1024  # 5MB
            content = response.content
            if len(content) > max_size:
                logger.warning(f"Image too large ({len(content)} bytes), skipping: {url}")
                return None
            
            local_path.write_bytes(content)
            logger.info(f"Downloaded image: {filename} from {url[:80]}...")
            return filename
            
    except httpx.HTTPStatusError as e:
        logger.warning(f"HTTP error downloading image {url}: {e.response.status_code}")
        return None
    except Exception as e:
        logger.warning(f"Failed to download image {url}: {e}")
        return None


async def download_images(urls: list[str], max_concurrent: int = 3) -> dict[str, Optional[str]]:
    """
    Download multiple images concurrently.
    
    Args:
        urls: List of image URLs to download
        max_concurrent: Maximum number of concurrent downloads
        
    Returns:
        Dictionary mapping original URLs to local filenames (or None if failed)
    """
    semaphore = asyncio.Semaphore(max_concurrent)
    results = {}
    
    async def download_with_semaphore(url: str):
        async with semaphore:
            local_file = await download_image(url)
            results[url] = local_file
    
    tasks = [download_with_semaphore(url) for url in urls]
    await asyncio.gather(*tasks, return_exceptions=True)
    
    return results


def get_image_url(filename: str) -> str:
    """
    Get the URL to access a downloaded image.
    
    Args:
        filename: Local filename returned by download_image
        
    Returns:
        URL path to access the image
    """
    return f"{IMAGES_BASE_URL}/{filename}"

