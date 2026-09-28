from datetime import datetime
from typing import Optional

from beanie import Document
from pymongo import IndexModel


class CategoryDocument(Document):
    id: str
    user_id: str
    name: str
    slug: str
    color: Optional[str] = "#6366f1"
    is_investment: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Settings:
        name = "categories"
        indexes = [
            IndexModel([("user_id", 1)]),
            IndexModel([("user_id", 1), ("slug", 1)]),
        ]
