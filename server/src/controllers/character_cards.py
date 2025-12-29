import base64
import io
import json
from uuid import UUID
from litestar import Controller, get, patch
from litestar.exceptions import NotFoundException
from litestar.params import Body
from litestar.response import Response
from PIL import Image, PngImagePlugin

from db.character_cards import (
    CharacterCard,
    CreateCharacterCard,
    UpdateCharacterCard,
    create_or_update_character_card,
    get_character_card_by_project,
    update_character_card as db_update_character_card,
)
from db.common import SingleResponse
from db.projects import get_project as db_get_project
from logging_config import get_logger

logger = get_logger(__name__)


class CharacterCardController(Controller):
    path = "/projects/{project_id:str}/character"

    @get("/")
    async def get_character_card(
        self, project_id: str
    ) -> SingleResponse[CharacterCard]:
        """Get the character card for a project."""
        card = await get_character_card_by_project(project_id)
        if not card:
            # Return a default empty card structure if none exists
            return SingleResponse(
                data=CharacterCard(
                    id=UUID(int=0),
                    project_id=project_id,
                    created_at="1970-01-01T00:00:00Z",  # pyright: ignore
                    updated_at="1970-01-01T00:00:00Z",  # pyright: ignore
                )
            )
        return SingleResponse(data=card)

    @patch("/")
    async def update_character_card(
        self, project_id: str, data: UpdateCharacterCard = Body()
    ) -> SingleResponse[CharacterCard]:
        """Update a character card for a project."""
        project = await db_get_project(project_id)
        if not project:
            raise NotFoundException(f"Project '{project_id}' not found.")

        card = await get_character_card_by_project(project_id)
        if not card:
            # If no card exists, create one with the provided data
            new_card_data = CreateCharacterCard(
                project_id=project_id, **data.model_dump()
            )
            card = await create_or_update_character_card(new_card_data)
        else:
            # Otherwise, update the existing card
            card = await db_update_character_card(card.id, data)

        if not card:
            raise NotFoundException(
                f"Character card for project '{project_id}' not found."
            )
        return SingleResponse(data=card)

    @get("/export")
    async def export_character_card(self, project_id: str, format: str | None = None) -> Response:
        """
        Export the character card.

        - Default: PNG file embedding a Chara Card v2 JSON payload.
        - If `?format=json` is provided, returns the raw JSON instead.
        """
        card = await get_character_card_by_project(project_id)
        if not card or not card.name:
            raise NotFoundException("Character card is not generated or is empty.")

        # Format for v2 spec
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
                    # Lorecard-specific extension fields
                    "lorecard": {"avatar_url": card.avatar_url} if card.avatar_url else {},
                },
            },
        }

        safe_filename = "".join(
            c for c in card.name if c.isalnum() or c in " ._-"
        ).rstrip()

        # If JSON is requested, return raw JSON
        if format and format.lower() == "json":
            json_data = json.dumps(spec_v2_data, ensure_ascii=False)
            return Response(
                content=json_data,
                media_type="application/json",
                headers={
                    "Content-Disposition": f'attachment; filename="{safe_filename}.json"'
                },
            )

        # Otherwise, export as PNG with embedded JSON (v2 spec)
        json_data = json.dumps(spec_v2_data, ensure_ascii=False)
        encoded_data = base64.b64encode(json_data.encode("utf-8")).decode("utf-8")

        # Create a blank PNG image
        image = Image.new("RGB", (600, 900), "black")
        png_info = PngImagePlugin.PngInfo()
        png_info.add_text("chara", encoded_data)

        # Save image to a byte stream
        byte_io = io.BytesIO()
        image.save(byte_io, "PNG", pnginfo=png_info)
        byte_io.seek(0)

        return Response(
            content=byte_io.read(),
            media_type="image/png",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_filename}.png"'
            },
        )
