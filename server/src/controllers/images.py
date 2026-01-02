"""
Controller for serving downloaded images.
"""

from pathlib import Path
import os
from litestar import Controller, get
from litestar.response import File
from litestar.exceptions import NotFoundException
from logging_config import get_logger

logger = get_logger(__name__)

IMAGES_DIR = Path(os.path.abspath(__file__)).parent.parent.parent / "images"


class ImagesController(Controller):
    path = "/images"

    @get("/{filename:str}")
    async def get_image(self, filename: str) -> File:
        """Serve a downloaded image file."""
        # Security: prevent directory traversal
        if ".." in filename or "/" in filename or "\\" in filename:
            raise NotFoundException("Invalid filename")
        
        file_path = IMAGES_DIR / filename
        if not file_path.exists() or not file_path.is_file():
            raise NotFoundException(f"Image not found: {filename}")
        
        # Determine content type from extension
        ext = file_path.suffix.lower()
        media_type_map = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
            ".gif": "image/gif",
        }
        media_type = media_type_map.get(ext, "image/jpeg")
        
        return File(
            path=file_path,
            media_type=media_type,
            filename=filename,
        )

