from datetime import datetime
from typing import Optional

from beanie import Document
from pymongo import IndexModel


class PayeeDocument(Document):
    id: str
    user_id: str
    name: str
    slug: str
    color: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Settings:
        name = "payees"
        indexes = [
            IndexModel([("user_id", 1)]),
            IndexModel([("user_id", 1), ("slug", 1)]),
        ]
