from datetime import datetime
from typing import Optional, List, Any

from db.common import CreateGlobalTemplate, PaginatedResponse, PaginationMeta
from db.connection import get_db_connection
from pydantic import BaseModel

from db.database import AsyncDBTransaction


class GlobalTemplate(BaseModel):
    id: str
    name: str
    content: str
    user_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class UpdateGlobalTemplate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None


async def create_global_template(
    template: CreateGlobalTemplate,
    user_id: Optional[str] = None,
) -> GlobalTemplate:
    db = await get_db_connection()
    query = """
        INSERT INTO "GlobalTemplate" (id, name, content, user_id)
        VALUES (%s, %s, %s, %s)
        RETURNING *
    """
    params = (
        template.id,
        template.name,
        template.content,
        user_id,
    )
    result = await db.execute_and_fetch_one(query, params)
    if not result:
        raise Exception("Failed to create global template")
    return GlobalTemplate(**result)


async def get_global_template(
    template_id: str,
    user_id: Optional[str] = None,
) -> GlobalTemplate | None:
    """Retrieve a global template by its ID, only if owned by the user."""
    db = await get_db_connection()
    if user_id:
        # Only return template if owned by the user
        query = 'SELECT * FROM "GlobalTemplate" WHERE id = %s AND user_id = %s'
        result = await db.fetch_one(query, (template_id, user_id))
    else:
        query = 'SELECT * FROM "GlobalTemplate" WHERE id = %s'
        result = await db.fetch_one(query, (template_id,))
    return GlobalTemplate(**result) if result else None


async def count_global_templates(user_id: Optional[str] = None) -> int:
    """Count all global templates, optionally filtered by user_id."""
    db = await get_db_connection()
    if user_id:
        query = 'SELECT COUNT(*) as count FROM "GlobalTemplate" WHERE user_id = %s'
        result = await db.fetch_one(query, (user_id,))
    else:
        query = 'SELECT COUNT(*) as count FROM "GlobalTemplate"'
        result = await db.fetch_one(query)
    return result["count"] if result and "count" in result else 0


async def list_global_templates_paginated(
    limit: int = 50,
    offset: int = 0,
    user_id: Optional[str] = None,
) -> PaginatedResponse[GlobalTemplate]:
    """List all global templates with pagination, only returns templates owned by the user."""
    db = await get_db_connection()
    if user_id:
        # Only return templates owned by the user
        query = 'SELECT * FROM "GlobalTemplate" WHERE user_id = %s ORDER BY created_at DESC LIMIT %s OFFSET %s'
        results = await db.fetch_all(query, (user_id, limit, offset))
    else:
        query = 'SELECT * FROM "GlobalTemplate" ORDER BY created_at DESC LIMIT %s OFFSET %s'
        results = await db.fetch_all(query, (limit, offset))
    templates = [GlobalTemplate(**row) for row in results] if results else []
    total_items = await count_global_templates(user_id=user_id)
    current_page = offset // limit + 1

    return PaginatedResponse(
        data=templates,
        meta=PaginationMeta(
            current_page=current_page,
            per_page=limit,
            total_items=total_items,
        ),
    )


async def list_all_global_templates(
    tx: Optional[AsyncDBTransaction] = None,
    user_id: Optional[str] = None,
) -> list[GlobalTemplate]:
    """List all global templates, only returns templates owned by the user."""
    db = tx or await get_db_connection()
    if user_id:
        # Only return templates owned by the user
        query = 'SELECT * FROM "GlobalTemplate" WHERE user_id = %s ORDER BY created_at DESC'
        results = await db.fetch_all(query, (user_id,))
    else:
        query = 'SELECT * FROM "GlobalTemplate" ORDER BY created_at DESC'
        results = await db.fetch_all(query)
    return [GlobalTemplate(**row) for row in results] if results else []


async def update_global_template(
    template_id: str,
    template_update: UpdateGlobalTemplate,
    user_id: Optional[str] = None,
) -> GlobalTemplate | None:
    db = await get_db_connection()
    update_data = template_update.model_dump(exclude_unset=True)
    if not update_data:
        return await get_global_template(template_id, user_id=user_id)

    set_clause_parts = []
    params: List[Any] = []
    for key, value in update_data.items():
        set_clause_parts.append(f'"{key}" = %s')
        params.append(value)

    if not set_clause_parts:
        return await get_global_template(template_id, user_id=user_id)

    if user_id:
        params.append(template_id)
        params.append(user_id)
        set_clause = ", ".join(set_clause_parts)
        query = f'UPDATE "GlobalTemplate" SET {set_clause} WHERE id = %s AND user_id = %s RETURNING *'
    else:
        params.append(template_id)
        set_clause = ", ".join(set_clause_parts)
        query = f'UPDATE "GlobalTemplate" SET {set_clause} WHERE id = %s RETURNING *'

    result = await db.execute_and_fetch_one(query, tuple(params))
    return GlobalTemplate(**result) if result else None


async def delete_global_template(
    template_id: str,
    user_id: Optional[str] = None,
):
    """Delete a global template from the database, optionally filtered by user_id."""
    db = await get_db_connection()
    if user_id:
        query = 'DELETE FROM "GlobalTemplate" WHERE id = %s AND user_id = %s'
        await db.execute(query, (template_id, user_id))
    else:
        query = 'DELETE FROM "GlobalTemplate" WHERE id = %s'
        await db.execute(query, (template_id,))
