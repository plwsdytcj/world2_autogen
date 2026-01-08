from typing import List
from uuid import UUID

from db.common import SingleResponse
from db.credentials import (
    Credential,
    CreateCredential,
    UpdateCredential,
    create_credential,
    delete_credential,
    get_credential,
    list_credentials,
    update_credential,
)
from litestar import Controller, Request, get, post, patch, delete
from litestar.exceptions import NotFoundException
from litestar.params import Body

from controllers.auth import get_current_user_optional
from logging_config import get_logger

logger = get_logger(__name__)


class CredentialsController(Controller):
    path = "/credentials"

    @post("/")
    async def create_new_credential(
        self, request: Request, data: CreateCredential = Body()
    ) -> SingleResponse[Credential]:
        user = await get_current_user_optional(request)
        if user:
            data.user_id = user.id
        logger.debug(f"Creating credential {data.name} for user {data.user_id}")
        credential = await create_credential(data)
        return SingleResponse(data=credential)

    @get("/")
    async def list_all_credentials(self, request: Request) -> List[Credential]:
        user = await get_current_user_optional(request)
        user_id = user.id if user else None
        logger.debug(f"Listing credentials for user {user_id}")
        return await list_credentials(user_id=user_id)

    @get("/{credential_id:uuid}")
    async def get_credential_details(
        self, request: Request, credential_id: UUID
    ) -> SingleResponse[Credential]:
        user = await get_current_user_optional(request)
        user_id = user.id if user else None
        logger.debug(f"Retrieving credential {credential_id} for user {user_id}")
        credential = await get_credential(credential_id, user_id=user_id)
        if not credential:
            raise NotFoundException(f"Credential '{credential_id}' not found.")
        return SingleResponse(data=credential)

    @patch("/{credential_id:uuid}")
    async def update_existing_credential(
        self, request: Request, credential_id: UUID, data: UpdateCredential = Body()
    ) -> SingleResponse[Credential]:
        user = await get_current_user_optional(request)
        user_id = user.id if user else None
        logger.debug(f"Updating credential {credential_id} for user {user_id}")
        credential = await update_credential(credential_id, data, user_id=user_id)
        if not credential:
            raise NotFoundException(f"Credential '{credential_id}' not found.")
        return SingleResponse(data=credential)

    @delete("/{credential_id:uuid}")
    async def delete_existing_credential(self, request: Request, credential_id: UUID) -> None:
        user = await get_current_user_optional(request)
        user_id = user.id if user else None
        logger.debug(f"Deleting credential {credential_id} for user {user_id}")
        await delete_credential(credential_id, user_id=user_id)
