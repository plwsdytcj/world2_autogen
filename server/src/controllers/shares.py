import base64
import io
import os
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from litestar import Controller, get, post
from litestar.exceptions import HTTPException, NotFoundException
from litestar.params import Body
from litestar.response import Response
from pydantic import BaseModel, Field
from PIL import Image, PngImagePlugin

from db.projects import get_project
from db.lorebook_entries import list_all_entries_by_project
from db.character_cards import get_character_card_by_project
from db.shares import (
    CreateShare,
    Share,
    create_share,
    get_share,
    increment_share_uses,
    verify_token,
)
from logging_config import get_logger

logger = get_logger(__name__)


class CreateSharePayload(BaseModel):
    project_id: str
    content_type: Literal["character", "lorebook"]
    export_format: Literal["json", "png"]
    expires_in_s: int = Field(default=3600, ge=60, le=7 * 24 * 3600)
    max_uses: int = Field(default=3, ge=1, le=50)


class CreateShareResponse(BaseModel):
    share_id: str
    token: str
    links: dict


class ResolvePayload(BaseModel):
    token: str


class ResolveResponse(BaseModel):
    download_url: str
    content_type: str
    export_format: str
    filename: Optional[str] = None


def _short_id() -> str:
    return "sh_" + uuid.uuid4().hex[:8]


def _gen_token() -> str:
    return base64.urlsafe_b64encode(os.urandom(24)).decode().rstrip("=")


class ShareController(Controller):
    path = "/shares"

    @post("/")
    async def create_share_endpoint(
        self, data: CreateSharePayload = Body()
    ) -> CreateShareResponse:
        if data.content_type == "lorebook" and data.export_format != "json":
            raise HTTPException(status_code=400, detail="Lorebook export supports JSON only.")

        project = await get_project(data.project_id)
        if not project:
            raise NotFoundException("Project not found")

        share_id = _short_id()
        token = _gen_token()

        share = await create_share(
            share_id,
            token,
            CreateShare(
                content_type=data.content_type,
                project_id=data.project_id,
                export_format=data.export_format,
                expires_in_s=data.expires_in_s,
                max_uses=data.max_uses,
            ),
        )

        t = "c" if share.content_type == "character" else "l"
        # 在生成的链接中附带一次性 token，便于扫码端直接解析并导入
        universal = f"/i?s={share.id}&t={t}&v=1&k={token}"  # 前端可拼接域名

        # URL Scheme（包含可选 avatar 外链，便于移动端快速展示头像）
        # 使用 poki:// 作为备用 scheme
        scheme = f"poki://import?s={share.id}&t={t}&v=1&k={token}"
        if share.content_type == "character":
            card = await get_character_card_by_project(share.project_id)
            if card and card.avatar_url:
                import urllib.parse as _urlparse
                scheme += f"&avatar={_urlparse.quote(card.avatar_url, safe='')}"

        return CreateShareResponse(
            share_id=share.id,
            token=token,
            links={"universal": universal, "scheme": scheme},
        )

    @post("/{share_id:str}/resolve")
    async def resolve_share(self, share_id: str, data: ResolvePayload = Body()) -> ResolveResponse:
        share = await get_share(share_id)
        if not share:
            raise NotFoundException("Share not found")
        if share.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            raise HTTPException(status_code=410, detail="Share expired")
        if share.uses >= share.max_uses:
            raise HTTPException(status_code=410, detail="Share exhausted")
        if not verify_token(share, data.token):
            raise HTTPException(status_code=403, detail="Invalid token")

        filename = None
        if share.content_type == "character":
            card = await get_character_card_by_project(share.project_id)
            filename = (card.name if card and card.name else share.project_id) + (
                ".json" if share.export_format == "json" else ".png"
            )
        else:
            filename = f"{share.project_id}.json"

        url = f"/api/shares/{share.id}/content?token={data.token}"
        return ResolveResponse(
            download_url=url,
            content_type=share.content_type,
            export_format=share.export_format,
            filename=filename,
        )

    @get("/{share_id:str}/content")
    async def download_share_content(self, share_id: str, token: str) -> Response:
        share = await get_share(share_id)
        if not share:
            raise NotFoundException("Share not found")
        if share.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            raise HTTPException(status_code=410, detail="Share expired")
        if share.uses >= share.max_uses:
            raise HTTPException(status_code=410, detail="Share exhausted")
        if not verify_token(share, token):
            raise HTTPException(status_code=403, detail="Invalid token")

        # 生成内容
        if share.content_type == "character":
            card = await get_character_card_by_project(share.project_id)
            if not card or not card.name:
                raise NotFoundException("Character card is not generated or is empty.")

            spec_v2_data = {
                "spec": "chara_card_v2",
                "spec_version": "2.0",
                "data": {
                    "name": card.name,
                    "description": card.description,
                    "personality": card.persona,
                    "scenario": card.scenario,
                    "first_mes": card.first_message,
                    "mes_example": card.example_messages,
                    "creator_notes": "",
                    "system_prompt": "",
                    "post_history_instructions": "",
                    "alternate_greetings": [],
                    "tags": [],
                    "creator": "Lorecard",
                    "character_version": "1.0",
                    "extensions": {
                        "lorecard": {"avatar_url": card.avatar_url} if card.avatar_url else {},
                    },
                },
            }

            safe_filename = "".join(c for c in card.name if c.isalnum() or c in " ._-").rstrip()

            if share.export_format == "json":
                content = Response(
                    content=__import__("json").dumps(spec_v2_data, ensure_ascii=False),
                    media_type="application/json",
                    headers={
                        "Content-Disposition": f'attachment; filename="{safe_filename}.json"'
                    },
                )
            else:  # png
                json_data = __import__("json").dumps(spec_v2_data, ensure_ascii=False)
                encoded = base64.b64encode(json_data.encode("utf-8")).decode("utf-8")
                image = Image.new("RGB", (600, 900), "black")
                meta = PngImagePlugin.PngInfo()
                meta.add_text("chara", encoded)
                bio = io.BytesIO()
                image.save(bio, "PNG", pnginfo=meta)
                bio.seek(0)
                content = Response(
                    content=bio.read(),
                    media_type="image/png",
                    headers={
                        "Content-Disposition": f'attachment; filename="{safe_filename}.png"'
                    },
                )
        else:  # lorebook
            entries = await list_all_entries_by_project(share.project_id)
            if not entries:
                raise NotFoundException("Lorebook not generated yet or empty.")
            entries_dict = {}
            for i, entry in enumerate(entries):
                entries_dict[str(i)] = {
                    "key": entry.keywords,
                    "keysecondary": [],
                    "comment": entry.title,
                    "content": entry.content,
                    "order": 100,
                    "position": 4,
                    "disable": False,
                    "probability": 100,
                    "useProbability": True,
                    "depth": 0,
                    "uid": i,
                }
            payload = {"entries": entries_dict}
            import json as _json

            content = Response(
                content=_json.dumps(payload, ensure_ascii=False),
                media_type="application/json",
                headers={
                    "Content-Disposition": f'attachment; filename="{share.project_id}.json"'
                },
            )

        # 记一次使用
        await increment_share_uses(share.id)
        return content
