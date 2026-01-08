from litestar import Controller, Request, get, post, patch, delete
from litestar.exceptions import NotFoundException, HTTPException
from litestar.params import Body
from pydantic import BaseModel
from typing import Optional

from logging_config import get_logger
from controllers.auth import get_current_user_optional, require_auth
from db.connection import get_db_connection
from db.projects import (
    Project,
    CreateProject,
    UpdateProject,
    create_project as db_create_project,
    get_project as db_get_project,
    list_projects_paginated as db_list_projects_paginated,
    update_project as db_update_project,
    delete_project as db_delete_project,
)
from db.links import (
    Link,
    count_processable_links_by_project as db_count_processable_links_by_project,
    list_links_by_project_paginated as db_list_links_by_project_paginated,
)
from db.lorebook_entries import (
    LorebookEntry,
    list_entries_by_project_paginated as db_list_entries_by_project_paginated,
    list_all_entries_by_project as db_list_all_entries_by_project,
)
from db.api_request_logs import (
    ApiRequestLog,
    list_logs_by_project_paginated as db_list_logs_by_project_paginated,
)
from db.common import PaginatedResponse, SingleResponse

logger = get_logger(__name__)


class CountResponse(BaseModel):
    count: int


class ProjectController(Controller):
    path = "/projects"

    @post("/")
    async def create_project(
        self, request: Request, data: CreateProject = Body()
    ) -> SingleResponse[Project]:
        """Create a new project. Requires authentication."""
        user = await require_auth(request)
        data.user_id = user.id
        
        # Check if project ID already exists for this user
        # Note: Different users can have projects with the same ID
        existing_project = await db_get_project(data.id, user_id=data.user_id)
        if existing_project:
            raise HTTPException(
                status_code=409,
                detail=f"Project with ID '{data.id}' already exists. Please choose a different ID."
            )
        
        logger.debug(f"Creating project {data.id} of type {data.project_type} for user {data.user_id}")
        
        # If project ID already exists globally (different user), try to make it unique by appending user_id suffix
        original_id = data.id
        # Check globally (without user_id filter) to see if another user has this ID
        # We need to query directly since get_project now requires user_id
        db = await get_db_connection()
        global_check_query = 'SELECT * FROM "Project" WHERE id = %s'
        global_existing = await db.fetch_one(global_check_query, (data.id,))
        
        if global_existing:
            # Different user has this ID - make it unique by appending user_id hash
            # Use first 8 chars of user_id to keep ID readable
            user_suffix = data.user_id[:8]
            data.id = f"{original_id}-{user_suffix}"
            logger.info(f"Project ID '{original_id}' already exists for another user. Using '{data.id}' instead.")
        
        try:
            project = await db_create_project(data)
            return SingleResponse(data=project)
        except Exception as e:
            # Catch database unique constraint violations (race condition fallback)
            error_str = str(e).lower()
            if "duplicate key" in error_str or "unique constraint" in error_str or "uniqueviolation" in error_str:
                # If we already modified the ID and it still conflicts, try with timestamp
                if data.id == original_id:
                    # This shouldn't happen if our check worked, but handle it anyway
                    import time
                    data.id = f"{original_id}-{int(time.time())}"
                    try:
                        project = await db_create_project(data)
                        return SingleResponse(data=project)
                    except:
                        raise HTTPException(
                            status_code=409,
                            detail=f"Project with ID '{original_id}' already exists. Please choose a different ID."
                        )
                else:
                    raise HTTPException(
                        status_code=409,
                        detail=f"Project with ID '{data.id}' already exists. Please choose a different ID."
                    )
            # Re-raise other exceptions
            raise

    @get("/")
    async def list_projects(
        self, request: Request, limit: int = 50, offset: int = 0
    ) -> PaginatedResponse[Project]:
        """List all projects with pagination, filtered by current user."""
        user = await get_current_user_optional(request)
        user_id = user.id if user else None
        logger.debug(f"Listing projects for user {user_id}")
        return await db_list_projects_paginated(limit, offset, user_id=user_id)

    @get("/{project_id:str}/links")
    async def list_project_links(
        self, project_id: str, limit: int = 100, offset: int = 0
    ) -> PaginatedResponse[Link]:
        """List all links for a project with pagination."""
        logger.debug(f"Listing links for project {project_id}")
        return await db_list_links_by_project_paginated(project_id, limit, offset)

    @get("/{project_id:str}/links/processable-count")
    async def get_processable_links_count(
        self, project_id: str
    ) -> SingleResponse[CountResponse]:
        """Get the count of processable (pending or failed) links for a project."""
        logger.debug(f"Counting processable links for project {project_id}")
        count = await db_count_processable_links_by_project(project_id)
        return SingleResponse(data=CountResponse(count=count))

    @get("/{project_id:str}/entries")
    async def list_project_entries(
        self,
        project_id: str,
        limit: int = 100,
        offset: int = 0,
        q: Optional[str] = None,
    ) -> PaginatedResponse[LorebookEntry]:
        """List all lorebook entries for a project with pagination and optional search."""
        logger.debug(f"Listing entries for project {project_id}")
        return await db_list_entries_by_project_paginated(
            project_id, limit, offset, search_query=q
        )

    @get("/{project_id:str}/logs")
    async def list_project_api_logs(
        self, project_id: str, limit: int = 100, offset: int = 0
    ) -> PaginatedResponse[ApiRequestLog]:
        """List all API request logs for a project with pagination."""
        logger.debug(f"Listing API logs for project {project_id}")
        return await db_list_logs_by_project_paginated(project_id, limit, offset)

    @get("/{project_id:str}")
    async def get_project(self, request: Request, project_id: str) -> SingleResponse[Project]:
        """Retrieve a single project by its ID, filtered by current user."""
        user = await get_current_user_optional(request)
        user_id = user.id if user else None
        logger.debug(f"Retrieving project {project_id} for user {user_id}")
        project = await db_get_project(project_id, user_id=user_id)
        if not project:
            raise NotFoundException(f"Project '{project_id}' not found.")
        return SingleResponse(data=project)

    @patch("/{project_id:str}")
    async def update_project(
        self, request: Request, project_id: str, data: UpdateProject = Body()
    ) -> SingleResponse[Project]:
        """Update a project, filtered by current user."""
        user = await get_current_user_optional(request)
        user_id = user.id if user else None
        logger.debug(f"Updating project {project_id} for user {user_id}")
        project = await db_update_project(project_id, data, user_id=user_id)
        if not project:
            raise NotFoundException(f"Project '{project_id}' not found.")
        return SingleResponse(data=project)

    @delete("/{project_id:str}")
    async def delete_project(self, request: Request, project_id: str) -> None:
        """Delete a project, filtered by current user."""
        user = await get_current_user_optional(request)
        user_id = user.id if user else None
        logger.debug(f"Deleting project {project_id} for user {user_id}")
        await db_delete_project(project_id, user_id=user_id)

    @get("/{project_id:str}/lorebook/download")
    async def download_project_lorebook(
        self,
        request: Request,
        project_id: str,
    ) -> dict:
        """Get the lorebook in downloadable format with numbered entries."""
        user = await get_current_user_optional(request)
        user_id = user.id if user else None
        project = await db_get_project(project_id, user_id=user_id)
        if not project:
            raise NotFoundException(detail="Project not found")

        entries = await db_list_all_entries_by_project(project_id)
        if not entries:
            raise NotFoundException(
                detail="Lorebook not generated yet or generation failed."
            )

        # Transform to downloadable format
        entries_dict = {}
        # Ensure entries exist before iterating
        for i, entry in enumerate(entries):
            entries_dict[str(i)] = {
                "key": entry.keywords,
                "keysecondary": [],
                "comment": entry.title,
                "content": entry.content,
                "order": 100,  # Default order for all entries
                "position": 4,  # Sequential position
                "disable": False,
                "probability": 100,
                "useProbability": True,
                "depth": 0,
                "uid": i,  # Use index as UID
            }

        return {"entries": entries_dict}
