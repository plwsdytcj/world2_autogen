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
    """Retrieve a global template by its ID. Returns user's template or global template (user_id IS NULL)."""
    db = await get_db_connection()
    if user_id:
        # Return template if owned by user OR is global (user_id IS NULL)
        query = 'SELECT * FROM "GlobalTemplate" WHERE id = %s AND (user_id = %s OR user_id IS NULL)'
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
    """List all global templates with pagination. Returns user's templates + global templates (user_id IS NULL)."""
    db = await get_db_connection()
    if user_id:
        # Return templates owned by user OR global templates (user_id IS NULL)
        # Order: user templates first, then global templates
        query = 'SELECT * FROM "GlobalTemplate" WHERE user_id = %s OR user_id IS NULL ORDER BY CASE WHEN user_id IS NULL THEN 1 ELSE 0 END, created_at DESC LIMIT %s OFFSET %s'
        results = await db.fetch_all(query, (user_id, limit, offset))
    else:
        query = 'SELECT * FROM "GlobalTemplate" ORDER BY created_at DESC LIMIT %s OFFSET %s'
        results = await db.fetch_all(query, (limit, offset))
    templates = [GlobalTemplate(**row) for row in results] if results else []
    # Count user templates + global templates
    if user_id:
        count_query = 'SELECT COUNT(*) as count FROM "GlobalTemplate" WHERE user_id = %s OR user_id IS NULL'
        count_result = await db.fetch_one(count_query, (user_id,))
        total_items = count_result["count"] if count_result and "count" in count_result else 0
    else:
        total_items = await count_global_templates()
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
    """List all global templates. Returns user's templates + global templates (user_id IS NULL)."""
    db = tx or await get_db_connection()
    if user_id:
        # Return templates owned by user OR global templates (user_id IS NULL)
        # Order: user templates first, then global templates
        query = 'SELECT * FROM "GlobalTemplate" WHERE user_id = %s OR user_id IS NULL ORDER BY CASE WHEN user_id IS NULL THEN 1 ELSE 0 END, created_at DESC'
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
    """Update a global template. Only allows updating user's own templates, not global templates (user_id IS NULL)."""
    db = await get_db_connection()
    
    # First check if template exists and if it's a global template (user_id IS NULL)
    existing_template = await get_global_template(template_id)
    if not existing_template:
        return None
    
    # Prevent updating global templates (user_id IS NULL)
    if existing_template.user_id is None:
        raise ValueError("Cannot update global templates. Global templates are read-only.")
    
    # Only allow updating if user_id matches
    if user_id and existing_template.user_id != user_id:
        raise ValueError("Cannot update template owned by another user.")
    
    # Require user_id for updating (cannot update without authentication)
    if not user_id:
        raise ValueError("Cannot update template without user authentication.")
    
    update_data = template_update.model_dump(exclude_unset=True)
    if not update_data:
        return existing_template

    set_clause_parts = []
    params: List[Any] = []
    for key, value in update_data.items():
        set_clause_parts.append(f'"{key}" = %s')
        params.append(value)

    if not set_clause_parts:
        return existing_template

    # Only update if user_id matches (already checked above)
    params.append(template_id)
    params.append(user_id)
    set_clause = ", ".join(set_clause_parts)
    query = f'UPDATE "GlobalTemplate" SET {set_clause} WHERE id = %s AND user_id = %s RETURNING *'

    result = await db.execute_and_fetch_one(query, tuple(params))
    return GlobalTemplate(**result) if result else None


async def delete_global_template(
    template_id: str,
    user_id: Optional[str] = None,
):
    """Delete a global template. Only allows deleting user's own templates, not global templates (user_id IS NULL)."""
    db = await get_db_connection()
    
    # First check if template exists and if it's a global template (user_id IS NULL)
    existing_template = await get_global_template(template_id)
    if not existing_template:
        return
    
    # Prevent deleting global templates (user_id IS NULL)
    if existing_template.user_id is None:
        raise ValueError("Cannot delete global templates. Global templates are read-only.")
    
    # Only allow deleting if user_id matches
    if user_id and existing_template.user_id != user_id:
        raise ValueError("Cannot delete template owned by another user.")
    
    # Require user_id for deleting (cannot delete without authentication)
    if not user_id:
        raise ValueError("Cannot delete template without user authentication.")
    
    # Only delete if user_id matches (already checked above)
    query = 'DELETE FROM "GlobalTemplate" WHERE id = %s AND user_id = %s'
    await db.execute(query, (template_id, user_id))
