import hashlib
from datetime import datetime, timedelta
from typing import Optional

from pydantic import BaseModel

from db.connection import get_db_connection


class Share(BaseModel):
    id: str
    content_type: str  # 'character' | 'lorebook'
    project_id: str
    export_format: str  # 'json' | 'png'
    token_hash: str
    expires_at: datetime
    max_uses: int
    uses: int
    created_at: datetime
    updated_at: datetime


class CreateShare(BaseModel):
    content_type: str
    project_id: str
    export_format: str
    expires_in_s: int = 3600
    max_uses: int = 3


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def create_share(id: str, token: str, data: CreateShare) -> Share:
    db = await get_db_connection()
    query = (
        "INSERT INTO \"Share\" (id, content_type, project_id, export_format, token_hash, expires_at, max_uses) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING *"
    )
    expires_at = datetime.utcnow() + timedelta(seconds=data.expires_in_s)
    params = (
        id,
        data.content_type,
        data.project_id,
        data.export_format,
        _hash_token(token),
        expires_at,
        data.max_uses,
    )
    row = await db.execute_and_fetch_one(query, params)
    return Share(**row)  # type: ignore[arg-type]


async def get_share(share_id: str) -> Optional[Share]:
    db = await get_db_connection()
    row = await db.fetch_one('SELECT * FROM "Share" WHERE id = %s', (share_id,))
    return Share(**row) if row else None


async def increment_share_uses(share_id: str) -> None:
    db = await get_db_connection()
    await db.execute(
        'UPDATE "Share" SET uses = uses + 1, updated_at = CURRENT_TIMESTAMP WHERE id = %s',
        (share_id,),
    )


def verify_token(share: Share, token: str) -> bool:
    return _hash_token(token) == share.token_hash

