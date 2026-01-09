from litestar import Controller, Request, get, post, patch, delete
from litestar.exceptions import NotFoundException, HTTPException
from typing import Dict
from litestar.params import Body

from logging_config import get_logger
from controllers.auth import get_current_user_optional
from db.global_templates import (
    GlobalTemplate,
    CreateGlobalTemplate,
    UpdateGlobalTemplate,
    create_global_template as db_create_global_template,
    get_global_template as db_get_global_template,
    list_global_templates_paginated as db_list_global_templates_paginated,
    update_global_template as db_update_global_template,
    delete_global_template as db_delete_global_template,
)
from db.common import PaginatedResponse, SingleResponse
import default_templates

logger = get_logger(__name__)


class GlobalTemplateController(Controller):
    path = "/global-templates"

    @get(
        "/defaults",
        summary="Get Default Templates",
        description="Retrieve the hardcoded default templates.",
    )
    async def get_default_templates(self) -> Dict[str, str]:
        """Returns a dictionary of the default templates."""
        logger.debug("Retrieving default templates")
        return {
            "selector-prompt": default_templates.selector_prompt,
            "search-params-prompt": default_templates.search_params_prompt,
            "entry-creation-prompt": default_templates.entry_creation_prompt,
            "lorebook-definition": default_templates.lorebook_definition,
            "character-card-definition": default_templates.character_card_definition,
            "character-generation-prompt": default_templates.character_generation_prompt,
            "character-field-regeneration-prompt": default_templates.character_field_regeneration_prompt,
            "json-formatter-prompt": default_templates.json_formatter_prompt,
            "social-media-character-prompt": default_templates.social_media_character_prompt,
            "social-media-lorebook-prompt": default_templates.social_media_lorebook_prompt,
        }

    @post("/")
    async def create_global_template(
        self, request: Request, data: CreateGlobalTemplate = Body()
    ) -> SingleResponse[GlobalTemplate]:
        """Create a new global template."""
        user = await get_current_user_optional(request)
        user_id = user.id if user else None
        logger.debug(f"Creating global template {data.id} for user {user_id}")
        template = await db_create_global_template(data, user_id=user_id)
        return SingleResponse(data=template)

    @get("/")
    async def list_global_templates(
        self, request: Request, limit: int = 50, offset: int = 0
    ) -> PaginatedResponse[GlobalTemplate]:
        """List all global templates with pagination, filtered by current user."""
        user = await get_current_user_optional(request)
        user_id = user.id if user else None
        logger.debug(f"Listing global templates for user {user_id}")
        return await db_list_global_templates_paginated(limit, offset, user_id=user_id)

    @get("/{template_id:str}")
    async def get_global_template(
        self, request: Request, template_id: str
    ) -> SingleResponse[GlobalTemplate]:
        """Retrieve a single global template by its ID, filtered by current user."""
        user = await get_current_user_optional(request)
        user_id = user.id if user else None
        logger.debug(f"Retrieving global template {template_id} for user {user_id}")
        template = await db_get_global_template(template_id, user_id=user_id)
        if not template:
            raise NotFoundException(f"Global template '{template_id}' not found.")
        return SingleResponse(data=template)

    @patch("/{template_id:str}")
    async def update_global_template(
        self, request: Request, template_id: str, data: UpdateGlobalTemplate = Body()
    ) -> SingleResponse[GlobalTemplate]:
        """Update a global template. Only allows updating user's own templates, not global templates."""
        user = await get_current_user_optional(request)
        user_id = user.id if user else None
        logger.debug(f"Updating global template {template_id} for user {user_id}")
        try:
            template = await db_update_global_template(template_id, data, user_id=user_id)
            if not template:
                raise NotFoundException(f"Global template '{template_id}' not found.")
            return SingleResponse(data=template)
        except ValueError as e:
            # Handle read-only global template error
            raise HTTPException(status_code=403, detail=str(e))

    @delete("/{template_id:str}")
    async def delete_global_template(self, request: Request, template_id: str) -> None:
        """Delete a global template. Only allows deleting user's own templates, not global templates."""
        user = await get_current_user_optional(request)
        user_id = user.id if user else None
        logger.debug(f"Deleting global template {template_id} for user {user_id}")
        try:
            await db_delete_global_template(template_id, user_id=user_id)
        except ValueError as e:
            # Handle read-only global template error
            raise HTTPException(status_code=403, detail=str(e))
