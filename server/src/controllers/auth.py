"""
Authentication controller for Google OAuth endpoints.
"""

import os
from typing import Optional
from urllib.parse import urlencode

from litestar import Controller, Request, Response, get, post
from litestar.exceptions import HTTPException
from litestar.status_codes import HTTP_302_FOUND, HTTP_401_UNAUTHORIZED
from pydantic import BaseModel

from db.users import User
from services.auth import (
    AuthTokens,
    create_tokens,
    decode_token,
    get_google_auth_url,
    handle_google_callback,
    refresh_access_token,
    revoke_session,
    verify_access_token,
)
from logging_config import get_logger

logger = get_logger(__name__)

# Frontend URL for redirects after authentication
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


class UserResponse(BaseModel):
    """User response model."""
    id: str
    email: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None


class RefreshRequest(BaseModel):
    """Refresh token request."""
    refresh_token: str


class LogoutRequest(BaseModel):
    """Logout request."""
    refresh_token: Optional[str] = None


class AuthController(Controller):
    """Authentication endpoints."""
    
    path = "/auth"
    tags = ["Authentication"]
    
    @get("/login/google")
    async def google_login(self, redirect_url: Optional[str] = None) -> Response:
        """
        Redirect to Google OAuth login.
        
        Args:
            redirect_url: Optional URL to redirect to after login
        """
        try:
            # Store redirect_url in state if provided
            state = redirect_url or "/"
            auth_url = get_google_auth_url(state=state)
            
            return Response(
                content=None,
                status_code=HTTP_302_FOUND,
                headers={"Location": auth_url},
            )
        except ValueError as e:
            logger.error(f"Google OAuth not configured: {e}")
            raise HTTPException(
                status_code=500,
                detail="Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
            )
    
    @get("/callback/google")
    async def google_callback(
        self,
        code: Optional[str] = None,
        state: Optional[str] = None,
        error: Optional[str] = None,
    ) -> Response:
        """
        Handle Google OAuth callback.
        
        This endpoint is called by Google after user authentication.
        It exchanges the code for tokens, creates/updates the user,
        and redirects to the frontend with JWT tokens.
        """
        if error:
            logger.error(f"Google OAuth error: {error}")
            redirect_url = f"{FRONTEND_URL}/login?error={error}"
            return Response(
                content=None,
                status_code=HTTP_302_FOUND,
                headers={"Location": redirect_url},
            )
        
        if not code:
            logger.error("No code in Google callback")
            redirect_url = f"{FRONTEND_URL}/login?error=no_code"
            return Response(
                content=None,
                status_code=HTTP_302_FOUND,
                headers={"Location": redirect_url},
            )
        
        try:
            user, tokens = await handle_google_callback(code)
            
            # Redirect to frontend with tokens in URL hash (client-side only)
            # The frontend will extract tokens and store them
            params = {
                "access_token": tokens.access_token,
                "refresh_token": tokens.refresh_token,
                "expires_in": str(tokens.expires_in),
            }
            
            # Use state as redirect path if provided
            redirect_path = state if state and state.startswith("/") else "/"
            redirect_url = f"{FRONTEND_URL}{redirect_path}#auth={urlencode(params)}"
            
            logger.info(f"User logged in: {user.email}")
            
            return Response(
                content=None,
                status_code=HTTP_302_FOUND,
                headers={"Location": redirect_url},
            )
            
        except Exception as e:
            logger.error(f"Google callback error: {e}", exc_info=True)
            redirect_url = f"{FRONTEND_URL}/login?error=callback_failed"
            return Response(
                content=None,
                status_code=HTTP_302_FOUND,
                headers={"Location": redirect_url},
            )
    
    @get("/me")
    async def get_current_user(self, request: Request) -> UserResponse:
        """
        Get current authenticated user.
        
        Requires Authorization header with Bearer token.
        """
        user = await self._get_user_from_request(request)
        
        return UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            avatar_url=user.avatar_url,
        )
    
    @post("/refresh")
    async def refresh_tokens(self, data: RefreshRequest) -> AuthTokens:
        """
        Refresh access token using refresh token.
        """
        tokens = await refresh_access_token(data.refresh_token)
        
        if not tokens:
            raise HTTPException(
                status_code=HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token",
            )
        
        return tokens
    
    @post("/logout")
    async def logout(self, data: LogoutRequest) -> dict:
        """
        Logout and revoke refresh token.
        """
        if data.refresh_token:
            await revoke_session(data.refresh_token)
        
        return {"success": True, "message": "Logged out successfully"}
    
    async def _get_user_from_request(self, request: Request):
        """Extract and verify user from request Authorization header."""
        auth_header = request.headers.get("Authorization")
        
        if not auth_header:
            raise HTTPException(
                status_code=HTTP_401_UNAUTHORIZED,
                detail="Authorization header required",
            )
        
        if not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization header format",
            )
        
        token = auth_header[7:]  # Remove "Bearer " prefix
        user = await verify_access_token(token)
        
        if not user:
            raise HTTPException(
                status_code=HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )
        
        return user


# ============================================================================
# Auth Guard Utility
# ============================================================================

async def get_current_user_optional(request: Request) -> Optional["User"]:
    """
    Get current user from request, returning None if not authenticated.
    Useful for endpoints that work for both authenticated and anonymous users.
    """
    auth_header = request.headers.get("Authorization")
    
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    
    token = auth_header[7:]
    return await verify_access_token(token)


async def require_auth(request: Request):
    """
    Require authentication for an endpoint.
    Raises HTTPException if not authenticated.
    """
    user = await get_current_user_optional(request)
    
    if not user:
        raise HTTPException(
            status_code=HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    
    return user

