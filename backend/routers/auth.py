import uuid
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from database import get_db
from models.users import User
from models_mongo.users import UserDocument
from schemas.users import UserCreate, UserLogin, UserResponse, Token, ChangePassword
from utils.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_active_user,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from services import mongo_sync
from config import READ_SOURCE

router = APIRouter()


def _register_pg(db: Session, user: UserCreate) -> User:
    """Blocking Postgres work for registration - must run via run_in_threadpool,
    never called directly from an async def body (blocks the event loop)."""
    existing = db.query(User).filter(User.email == user.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    hashed_password = get_password_hash(user.password)
    db_user = User(
        email=user.email,
        name=user.name,
        password_hash=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.post("/register", response_model=UserResponse)
async def register(user: UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    try:
        # Postgres stays the write source of truth this stage.
        db_user = await run_in_threadpool(_register_pg, db, user)
        # Awaited (not backgrounded): a register immediately followed by a
        # Mongo-read login must not race the mirror.
        await mongo_sync.mirror_user_upsert(db, db_user.id)
        return db_user
    except HTTPException:
        raise
    except Exception:
        await run_in_threadpool(db.rollback)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register user. Please try again."
        )


def _login_pg_lookup(db: Session, email: str):
    """Blocking Postgres lookup - see _register_pg for why this must be threadpooled."""
    return db.query(User).filter(User.email == email).first()


@router.post("/login", response_model=Token)
async def login(user_credentials: UserLogin, db: Session = Depends(get_db)):
    """Login user and return access token"""
    try:
        if READ_SOURCE == "mongo":
            user = await UserDocument.find_one(UserDocument.email == user_credentials.email)
        else:
            user = await run_in_threadpool(_login_pg_lookup, db, user_credentials.email)

        if not user or not verify_password(user_credentials.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.email}, expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed. Please try again."
        )

@router.get("/me", response_model=UserResponse)
def read_users_me(current_user = Depends(get_current_active_user)):
    """Get current user information"""
    return current_user

@router.post("/logout")
def logout():
    """Logout user (client should remove token)"""
    return {"message": "Successfully logged out"}


def _change_password_pg(db: Session, user_id: uuid.UUID, new_password_hash: str) -> User:
    """Blocking Postgres write - see _register_pg for why this must be threadpooled."""
    pg_user = db.query(User).filter(User.id == user_id).first()
    if not pg_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change password. Please try again."
        )
    pg_user.password_hash = new_password_hash
    db.commit()
    return pg_user


@router.post("/change-password")
async def change_password(
    password_data: ChangePassword,
    current_user = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Change user password"""
    try:
        # Verify current password
        if not verify_password(password_data.current_password, current_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )

        # Validate new password (basic validation)
        if len(password_data.new_password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be at least 6 characters long"
            )

        # current_user may be a Mongo UserDocument (READ_SOURCE=mongo) rather
        # than an attached SQLAlchemy instance, so re-fetch the Postgres row
        # to write to - Postgres stays the write source of truth this stage.
        new_password_hash = get_password_hash(password_data.new_password)
        pg_user = await run_in_threadpool(
            _change_password_pg, db, uuid.UUID(str(current_user.id)), new_password_hash
        )
        # Awaited (not backgrounded) for the same reason as register: an
        # immediate Mongo-read login must not race the mirror.
        await mongo_sync.mirror_user_upsert(db, pg_user.id)

        return {"message": "Password changed successfully"}

    except HTTPException:
        raise
    except Exception:
        await run_in_threadpool(db.rollback)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change password. Please try again."
        )
