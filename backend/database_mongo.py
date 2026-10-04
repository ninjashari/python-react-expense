import os

import motor.motor_asyncio
from beanie import init_beanie
from dotenv import load_dotenv

from models_mongo import ALL_DOCUMENT_MODELS

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGO_DB", "expense_manager")

_mongo_client: motor.motor_asyncio.AsyncIOMotorClient = None
_mongo_ready = False


def get_mongo_client() -> motor.motor_asyncio.AsyncIOMotorClient:
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URL)
    return _mongo_client


async def init_mongo() -> None:
    """Initialize the Motor client and register Beanie document models.

    Called on FastAPI startup. Postgres remains the source of truth during the
    dual-write transition, so a Mongo outage here must never crash the app -
    callers (main.py) log and continue rather than propagate.
    """
    global _mongo_ready
    client = get_mongo_client()
    await init_beanie(database=client[MONGODB_DB_NAME], document_models=ALL_DOCUMENT_MODELS)
    _mongo_ready = True


async def ensure_mongo_ready() -> bool:
    """Lazily init Beanie if the startup hook hasn't run yet (e.g. in scripts/tests).

    Returns False (without raising) if Mongo is unreachable, so dual-write callers
    can skip the mirror instead of blowing up the request.
    """
    global _mongo_ready
    if _mongo_ready:
        return True
    try:
        await init_mongo()
        return True
    except Exception:
        return False
