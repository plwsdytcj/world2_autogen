"""User database operations."""

from datetime import datetime
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel

from db.connection import get_db_connection
from db.database import AsyncDBTransaction
from logging_config import get_logger

logger = get_logger(__name__)


class User(BaseModel):
    """User model."""
    id: str
    google_id: Optional[str] = None
    email: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class CreateUser(BaseModel):
    """Data for creating a new user."""
    google_id: Optional[str] = None
    email: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None


async def get_user_by_id(
    user_id: str,
    tx: Optional[AsyncDBTransaction] = None,
) -> Optional[User]:
    """Get user by ID."""
    db = tx or await get_db_connection()
    query = 'SELECT * FROM "User" WHERE id = %s'
    result = await db.fetch_one(query, (user_id,))
    if not result:
        return None
    return User(**result)


async def get_user_by_google_id(
    google_id: str,
    tx: Optional[AsyncDBTransaction] = None,
) -> Optional[User]:
    """Get user by Google ID."""
    db = tx or await get_db_connection()
    query = 'SELECT * FROM "User" WHERE google_id = %s'
    result = await db.fetch_one(query, (google_id,))
    if not result:
        return None
    return User(**result)


async def get_user_by_email(
    email: str,
    tx: Optional[AsyncDBTransaction] = None,
) -> Optional[User]:
    """Get user by email."""
    db = tx or await get_db_connection()
    query = 'SELECT * FROM "User" WHERE email = %s'
    result = await db.fetch_one(query, (email,))
    if not result:
        return None
    return User(**result)


async def create_user(
    data: CreateUser,
    tx: Optional[AsyncDBTransaction] = None,
) -> User:
    """Create a new user."""
    db = tx or await get_db_connection()
    user_id = str(uuid4())
    
    query = """
        INSERT INTO "User" (id, google_id, email, name, avatar_url)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING *
    """
    result = await db.execute_and_fetch_one(
        query,
        (user_id, data.google_id, data.email, data.name, data.avatar_url),
    )
    
    if not result:
        raise Exception("Failed to create user")
    
    logger.info(f"Created new user: {data.email} (id: {user_id})")
    return User(**result)


async def update_user(
    user_id: str,
    name: Optional[str] = None,
    avatar_url: Optional[str] = None,
    tx: Optional[AsyncDBTransaction] = None,
) -> Optional[User]:
    """Update user information."""
    db = tx or await get_db_connection()
    
    set_parts = []
    params = []
    
    if name is not None:
        set_parts.append('"name" = %s')
        params.append(name)
    
    if avatar_url is not None:
        set_parts.append('"avatar_url" = %s')
        params.append(avatar_url)
    
    if not set_parts:
        return await get_user_by_id(user_id, tx=tx)
    
    set_clause = ", ".join(set_parts)
    params.append(user_id)
    
    query = f'UPDATE "User" SET {set_clause} WHERE id = %s RETURNING *'
    result = await db.execute_and_fetch_one(query, tuple(params))
    if not result:
        return None
    return User(**result)


async def get_or_create_user_by_google(
    google_id: str,
    email: str,
    name: Optional[str] = None,
    avatar_url: Optional[str] = None,
    tx: Optional[AsyncDBTransaction] = None,
) -> User:
    """
    Get existing user by Google ID or create a new one.
    Also updates name and avatar if changed.
    """
    # First try to find by Google ID
    user = await get_user_by_google_id(google_id, tx=tx)
    
    if user:
        # Update profile if changed
        if user.name != name or user.avatar_url != avatar_url:
            updated = await update_user(user.id, name=name, avatar_url=avatar_url, tx=tx)
            return updated or user
        return user
    
    # Check if email already exists (user might have registered differently)
    user = await get_user_by_email(email, tx=tx)
    if user:
        # Link Google ID to existing account
        db = tx or await get_db_connection()
        query = 'UPDATE "User" SET google_id = %s, name = %s, avatar_url = %s WHERE id = %s RETURNING *'
        result = await db.execute_and_fetch_one(query, (google_id, name, avatar_url, user.id))
        if result:
            return User(**result)
        return user
    
    # Create new user
    return await create_user(
        CreateUser(
            google_id=google_id,
            email=email,
            name=name,
            avatar_url=avatar_url,
        ),
        tx=tx,
    )

