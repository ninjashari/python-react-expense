from datetime import datetime
from typing import Optional

from beanie import Document


class UserDocument(Document):
    id: str
    email: str
    password_hash: str
    name: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Settings:
        name = "users"
