from fastapi import APIRouter

from routers.entities import router as entities_router
from routers.fs import router as fs_router
from routers.integrations import router as integrations_router
from routers.mcp_registry import router as mcp_registry_router
from routers.projects import router as projects_router
from routers.sync import router as sync_router

api_router = APIRouter(prefix="/api")
api_router.include_router(integrations_router)
api_router.include_router(projects_router)
api_router.include_router(fs_router)
api_router.include_router(mcp_registry_router)
api_router.include_router(sync_router)
# entities router has catch-all /{kind} routes — keep it last
api_router.include_router(entities_router)
