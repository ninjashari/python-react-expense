import os
from datetime import datetime, timedelta
from typing import Optional, Union
from jose import JWTError, jwt
import bcrypt
from fastapi import HTTPException, status, Depends
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
from models.users import User
from models_mongo.users import UserDocument
from schemas.users import TokenData
from config import READ_SOURCE

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY environment variable is not set. "
        "Generate one with `openssl rand -hex 32` and add it to your .env file."
    )
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 hours

security = HTTPBearer(auto_error=False)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def get_password_hash(password: str) -> str:
    """Hash a password"""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> TokenData:
    """Verify JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if credentials is None:
        raise credentials_exception
        
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception
    return token_data

def _lookup_pg_user(db: Session, email: str) -> Optional[User]:
    """Blocking Postgres lookup. Must run via run_in_threadpool: this function
    (get_current_user) is async and FastAPI awaits it directly on the event
    loop, so a bare synchronous db.query() call here would block the loop for
    every authenticated request - this was hit as a real hang during Stage 1
    development, not a theoretical concern."""
    return db.query(User).filter(User.email == email).first()


async def get_current_user(
    token: TokenData = Depends(verify_token),
    db: Session = Depends(get_db)
) -> Union[User, UserDocument]:
    """Get current authenticated user.

    Reads from Mongo or Postgres depending on READ_SOURCE (see config.py) -
    other, not-yet-converted routers keep working against either result since
    a plain string `.id` filters Postgres UUID columns transparently (verified
    empirically before this change landed).
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if READ_SOURCE == "mongo":
        user = await UserDocument.find_one(UserDocument.email == token.email)
    else:
        user = await run_in_threadpool(_lookup_pg_user, db, token.email)
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(
    current_user: Union[User, UserDocument] = Depends(get_current_user)
) -> Union[User, UserDocument]:
    """Get current active user"""
    return current_user