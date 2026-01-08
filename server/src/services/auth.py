"""
Authentication service for Google OAuth and JWT session management.
"""

import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

import httpx
from jose import JWTError, jwt
from pydantic import BaseModel

from db.connection import get_db_connection
from db.users import User, get_or_create_user_by_google, get_user_by_id
from logging_config import get_logger

logger = get_logger(__name__)

# JWT Configuration
JWT_SECRET = os.getenv("APP_SECRET_KEY", "change-me-in-production")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours
REFRESH_TOKEN_EXPIRE_DAYS = 30

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:3000/api/auth/callback/google")


class TokenPayload(BaseModel):
    """JWT token payload."""
    sub: str  # user_id
    email: str
    name: Optional[str] = None
    exp: datetime
    type: str  # "access" or "refresh"


class AuthTokens(BaseModel):
    """Authentication tokens."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class GoogleUserInfo(BaseModel):
    """Google user info from OAuth."""
    id: str
    email: str
    verified_email: bool = True
    name: Optional[str] = None
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    picture: Optional[str] = None


def create_access_token(user: User) -> str:
    """Create a JWT access token for a user."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user.id,
        "email": user.email,
        "name": user.name,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user: User) -> str:
    """Create a JWT refresh token for a user."""
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": user.id,
        "email": user.email,
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_tokens(user: User) -> AuthTokens:
    """Create both access and refresh tokens for a user."""
    return AuthTokens(
        access_token=create_access_token(user),
        refresh_token=create_refresh_token(user),
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


def decode_token(token: str) -> Optional[TokenPayload]:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return TokenPayload(**payload)
    except JWTError as e:
        logger.warning(f"JWT decode error: {e}")
        return None


async def verify_access_token(token: str) -> Optional[User]:
    """Verify an access token and return the user."""
    payload = decode_token(token)
    if not payload:
        return None
    
    if payload.type != "access":
        logger.warning("Token is not an access token")
        return None
    
    if payload.exp < datetime.now(timezone.utc):
        logger.warning("Token has expired")
        return None
    
    return await get_user_by_id(payload.sub)


async def refresh_access_token(refresh_token: str) -> Optional[AuthTokens]:
    """Refresh an access token using a refresh token."""
    payload = decode_token(refresh_token)
    if not payload:
        return None
    
    if payload.type != "refresh":
        logger.warning("Token is not a refresh token")
        return None
    
    if payload.exp < datetime.now(timezone.utc):
        logger.warning("Refresh token has expired")
        return None
    
    user = await get_user_by_id(payload.sub)
    if not user:
        return None
    
    return create_tokens(user)


# ============================================================================
# Google OAuth Flow
# ============================================================================

def get_google_auth_url(state: Optional[str] = None) -> str:
    """
    Generate Google OAuth authorization URL.
    
    Args:
        state: Optional state parameter for CSRF protection
        
    Returns:
        Google OAuth authorization URL
    """
    if not GOOGLE_CLIENT_ID:
        raise ValueError("GOOGLE_CLIENT_ID not configured")
    
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
    }
    
    if state:
        params["state"] = state
    else:
        params["state"] = secrets.token_urlsafe(16)
    
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return f"https://accounts.google.com/o/oauth2/v2/auth?{query}"


async def exchange_code_for_tokens(code: str) -> dict:
    """
    Exchange authorization code for Google tokens.
    
    Args:
        code: Authorization code from Google callback
        
    Returns:
        Token response from Google
    """
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise ValueError("Google OAuth not configured")
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": GOOGLE_REDIRECT_URI,
            },
        )
        
        if response.status_code != 200:
            logger.error(f"Google token exchange failed: {response.text}")
            raise ValueError(f"Failed to exchange code: {response.text}")
        
        return response.json()


async def get_google_user_info(access_token: str) -> GoogleUserInfo:
    """
    Get user info from Google using access token.
    
    Args:
        access_token: Google OAuth access token
        
    Returns:
        Google user information
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        
        if response.status_code != 200:
            logger.error(f"Failed to get Google user info: {response.text}")
            raise ValueError("Failed to get user info from Google")
        
        data = response.json()
        return GoogleUserInfo(**data)


async def handle_google_callback(code: str) -> tuple[User, AuthTokens]:
    """
    Handle Google OAuth callback.
    
    1. Exchange code for Google tokens
    2. Get user info from Google
    3. Create or update user in database
    4. Generate JWT tokens
    
    Args:
        code: Authorization code from Google
        
    Returns:
        Tuple of (User, AuthTokens)
    """
    # Exchange code for tokens
    token_response = await exchange_code_for_tokens(code)
    google_access_token = token_response.get("access_token")
    
    if not google_access_token:
        raise ValueError("No access token in Google response")
    
    # Get user info from Google
    google_user = await get_google_user_info(google_access_token)
    
    logger.info(f"Google OAuth login: {google_user.email} (Google ID: {google_user.id})")
    
    # Create or update user in database
    user = await get_or_create_user_by_google(
        google_id=google_user.id,
        email=google_user.email,
        name=google_user.name,
        avatar_url=google_user.picture,
    )
    
    # Generate JWT tokens
    tokens = create_tokens(user)
    
    return user, tokens


# ============================================================================
# Session Management
# ============================================================================

async def create_session(user_id: str, refresh_token: str) -> str:
    """Store a refresh token session in database."""
    db = await get_db_connection()
    session_id = str(uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    
    query = """
        INSERT INTO "Session" (id, user_id, refresh_token, expires_at)
        VALUES (%s, %s, %s, %s)
    """
    await db.execute(query, (session_id, user_id, refresh_token, expires_at.isoformat()))
    return session_id


async def revoke_session(refresh_token: str) -> bool:
    """Revoke a session by refresh token."""
    db = await get_db_connection()
    query = 'DELETE FROM "Session" WHERE refresh_token = %s'
    await db.execute(query, (refresh_token,))
    return True


async def revoke_all_sessions(user_id: str) -> bool:
    """Revoke all sessions for a user."""
    db = await get_db_connection()
    query = 'DELETE FROM "Session" WHERE user_id = %s'
    await db.execute(query, (user_id,))
    return True

