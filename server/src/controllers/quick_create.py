"""
Quick Create Controller - Simplified one-click character/lorebook generation.

This controller provides a streamlined API for creating character cards from URLs
with minimal user input. It handles project creation, source addition, content
fetching, and generation in a single flow.

Also provides an append endpoint for adding new sources to existing projects.
"""

import re
import time
from typing import List, Literal, Optional
from uuid import UUID

from litestar import Controller, Request, get, post
from litestar.exceptions import HTTPException
from litestar.params import Body
from pydantic import BaseModel, Field

from controllers.auth import require_auth
from db.background_jobs import (
    CreateBackgroundJob,
    FetchSourceContentPayload,
    GenerateCharacterCardPayload,
    GenerateLorebookEntriesPayload,
    TaskName,
    create_background_job,
)
from db.common import SingleResponse
from db.connection import get_db_connection
from db.credentials import list_credentials
from db.projects import (
    CreateProject,
    JsonEnforcementMode,
    Project,
    ProjectStatus,
    ProjectTemplates,
    ProjectType,
    create_project as db_create_project,
    get_project as db_get_project,
)
from db.sources import CreateProjectSource, create_project_source, list_sources_by_project
from logging_config import get_logger
from services.facebook_scraper import is_facebook_url
from services.twitter_scraper import is_twitter_url

logger = get_logger(__name__)


class QuickCreateRequest(BaseModel):
    """Request payload for quick create."""
    url: str = Field(..., description="URL to scrape (Twitter, Facebook, or web page)")
    project_type: Literal["character", "character_lorebook"] = Field(
        default="character",
        description="Type of output to generate"
    )
    # Optional advanced settings (collapsed by default in UI)
    credential_id: Optional[UUID] = None
    model_name: Optional[str] = None
    temperature: Optional[float] = Field(default=0.7, ge=0, le=2)
    tweets_limit: Optional[int] = Field(default=20, ge=5, le=100)


class QuickCreateResponse(BaseModel):
    """Response from quick create."""
    project_id: str
    project_name: str
    fetch_job_id: UUID
    message: str


class AppendContentRequest(BaseModel):
    """Request payload for appending content to existing project."""
    url: str = Field(..., description="New URL to add to the project")
    auto_regenerate: bool = Field(
        default=True,
        description="Automatically regenerate character card and lorebook with new content"
    )
    also_generate_lorebook: bool = Field(
        default=False,
        description="Generate lorebook entries even if project type is 'character' (will upgrade project)"
    )
    tweets_limit: Optional[int] = Field(default=20, ge=5, le=100)


class AppendContentResponse(BaseModel):
    """Response from append content."""
    project_id: str
    source_id: UUID
    fetch_job_id: UUID
    generate_job_ids: List[UUID] = []
    message: str


def _extract_name_from_url(url: str) -> str:
    """Extract a human-readable name from URL."""
    # Twitter/X
    if is_twitter_url(url):
        match = re.search(r'(?:twitter\.com|x\.com)/(@?\w+)', url, re.IGNORECASE)
        if match:
            username = match.group(1)
            return f"@{username}" if not username.startswith('@') else username
    
    # Facebook
    if is_facebook_url(url):
        match = re.search(r'facebook\.com/([^/?]+)', url, re.IGNORECASE)
        if match:
            page_name = match.group(1)
            return page_name.replace('.', ' ').title()
    
    # Generic URL - extract domain or path
    match = re.search(r'https?://(?:www\.)?([^/]+)(?:/([^/?]+))?', url)
    if match:
        domain = match.group(1)
        path = match.group(2)
        if path:
            return path.replace('-', ' ').replace('_', ' ').title()
        return domain
    
    return "Quick Project"


def _generate_project_id(name: str) -> str:
    """Generate a URL-safe project ID from name."""
    # Convert to lowercase, replace spaces with hyphens
    project_id = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    # Add timestamp to ensure uniqueness
    timestamp = int(time.time()) % 100000
    return f"{project_id}-{timestamp}"


class QuickCreateController(Controller):
    path = "/quick-create"

    @post("/")
    async def quick_create(
        self, request: Request, data: QuickCreateRequest = Body()
    ) -> SingleResponse[QuickCreateResponse]:
        """
        One-click character card generation from URL.
        
        This endpoint:
        1. Auto-detects URL type (Twitter, Facebook, web)
        2. Creates a project with smart defaults
        3. Adds the URL as a source
        4. Queues fetch and generate jobs
        
        Returns immediately with job IDs for progress tracking.
        """
        user = await require_auth(request)
        user_id = user.id
        
        # Validate URL
        url = data.url.strip()
        if not url.startswith(('http://', 'https://')):
            url = f"https://{url}"
        
        # Extract name from URL
        project_name = _extract_name_from_url(url)
        project_id = _generate_project_id(project_name)
        
        # Check if project ID already exists, add suffix if needed
        existing = await db_get_project(project_id, user_id=user_id)
        if existing:
            project_id = f"{project_id}-{int(time.time()) % 10000}"
        
        # Get default credential if not specified
        credential_id = data.credential_id
        model_name = data.model_name
        
        if not credential_id:
            # Find first available credential for this user
            credentials = await list_credentials(user_id=user_id)
            if not credentials:
                # Try global credentials
                credentials = await list_credentials(user_id=None)
            
            if credentials:
                # Prefer OpenRouter or OpenAI
                for cred in credentials:
                    if cred.provider_type in ['openrouter', 'openai', 'gemini']:
                        credential_id = cred.id
                        break
                if not credential_id:
                    credential_id = credentials[0].id
            else:
                raise HTTPException(
                    status_code=400,
                    detail="No API credentials configured. Please add a credential in Settings > Credentials."
                )
        
        # Set default model if not specified
        if not model_name:
            model_name = "google/gemini-2.0-flash-001"  # Fast and cheap default
        
        # Map project type
        project_type_map = {
            "character": ProjectType.CHARACTER,
            "character_lorebook": ProjectType.CHARACTER_LOREBOOK,
        }
        project_type = project_type_map[data.project_type]
        
        # Create project
        logger.info(f"Quick create: Creating project '{project_id}' for user {user_id}")
        
        project = await db_create_project(CreateProject(
            id=project_id,
            name=project_name,
            project_type=project_type,
            prompt=f"Create a character card based on {project_name}'s online presence",
            credential_id=credential_id,
            model_name=model_name,
            model_parameters={"temperature": data.temperature or 0.7},
            requests_per_minute=10,
            json_enforcement_mode=JsonEnforcementMode.prompt_engineering,
            templates=ProjectTemplates(),
            user_id=user_id,
        ))
        
        # Create source
        logger.info(f"Quick create: Adding source URL {url}")
        
        # Set appropriate limits for social media
        facebook_limit = data.tweets_limit or 20
        
        source = await create_project_source(CreateProjectSource(
            project_id=project.id,
            url=url,
            max_pages_to_crawl=1,
            max_crawl_depth=0,
            facebook_results_limit=facebook_limit,
        ))
        
        # Queue fetch job
        logger.info(f"Quick create: Queueing fetch job for source {source.id}")
        
        fetch_job = await create_background_job(CreateBackgroundJob(
            project_id=project.id,
            task_name=TaskName.FETCH_SOURCE_CONTENT,
            payload=FetchSourceContentPayload(source_ids=[source.id]),
        ))
        
        # Note: Generate job will be queued automatically after fetch completes
        # via the background job system (if we add auto-generate flag)
        # For now, frontend will poll and trigger generate when fetch completes
        
        return SingleResponse(data=QuickCreateResponse(
            project_id=project.id,
            project_name=project.name,
            fetch_job_id=fetch_job.id,
            message=f"Started processing {project_name}. Check the project page for progress."
        ))

    @post("/{project_id:str}/append")
    async def append_content(
        self, request: Request, project_id: str, data: AppendContentRequest = Body()
    ) -> SingleResponse[AppendContentResponse]:
        """
        Append new content to an existing project.
        
        This endpoint:
        1. Adds a new URL as a source to the project
        2. Queues a fetch job for the new source
        3. Optionally queues generation jobs in append mode
        
        The append mode ensures:
        - Existing character card is enhanced, not replaced
        - New lorebook entries are added without duplicating existing ones
        """
        user = await require_auth(request)
        user_id = user.id
        
        # Get existing project
        project = await db_get_project(project_id, user_id=user_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Validate URL
        url = data.url.strip()
        if not url.startswith(('http://', 'https://')):
            url = f"https://{url}"
        
        # Check if URL already exists as a source
        existing_sources = await list_sources_by_project(project_id)
        for source in existing_sources:
            if source.url.lower() == url.lower():
                raise HTTPException(
                    status_code=400,
                    detail=f"URL already exists as a source in this project"
                )
        
        # Create new source
        logger.info(f"Append content: Adding source URL {url} to project {project_id}")
        
        facebook_limit = data.tweets_limit or 20
        
        source = await create_project_source(CreateProjectSource(
            project_id=project_id,
            url=url,
            max_pages_to_crawl=1,
            max_crawl_depth=0,
            facebook_results_limit=facebook_limit,
        ))
        
        # Queue fetch job
        logger.info(f"Append content: Queueing fetch job for new source {source.id}")
        
        fetch_job = await create_background_job(CreateBackgroundJob(
            project_id=project_id,
            task_name=TaskName.FETCH_SOURCE_CONTENT,
            payload=FetchSourceContentPayload(source_ids=[source.id]),
        ))
        
        generate_job_ids = []
        
        # Queue generation jobs in append mode if auto_regenerate is enabled
        if data.auto_regenerate:
            logger.info(f"Append content: Queueing generation jobs in append mode")
            
            # Queue character card generation in append mode
            char_job = await create_background_job(CreateBackgroundJob(
                project_id=project_id,
                task_name=TaskName.GENERATE_CHARACTER_CARD,
                payload=GenerateCharacterCardPayload(append_mode=True),
            ))
            generate_job_ids.append(char_job.id)
            
            # Generate lorebook if:
            # 1. Project type is CHARACTER_LOREBOOK, OR
            # 2. User explicitly requested lorebook generation (also_generate_lorebook=True)
            should_generate_lorebook = (
                project.project_type == ProjectType.CHARACTER_LOREBOOK or 
                data.also_generate_lorebook
            )
            
            if should_generate_lorebook:
                lorebook_job = await create_background_job(CreateBackgroundJob(
                    project_id=project_id,
                    task_name=TaskName.GENERATE_LOREBOOK_ENTRIES,
                    payload=GenerateLorebookEntriesPayload(append_mode=True),
                ))
                generate_job_ids.append(lorebook_job.id)
                
                # If user requested lorebook but project was character-only, log it
                if project.project_type != ProjectType.CHARACTER_LOREBOOK and data.also_generate_lorebook:
                    logger.info(f"Append content: Generating lorebook for character-only project (user requested)")
        
        return SingleResponse(data=AppendContentResponse(
            project_id=project_id,
            source_id=source.id,
            fetch_job_id=fetch_job.id,
            generate_job_ids=generate_job_ids,
            message=f"Added new source and queued processing. {'Generation jobs will run in append mode.' if data.auto_regenerate else 'Fetch only.'}"
        ))

