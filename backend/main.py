import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import accounts, transactions, payees, categories, import_data, auth
import models

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Expense Manager API", version="1.0.0")

# CORS configuration for development and production
origins = [
    "http://localhost:3000",  # React development server
    "http://127.0.0.1:3000",  # Alternative localhost
    "http://localhost:3001",  # Alternative React port
    "http://127.0.0.1:3001",  # Alternative localhost
]

# Add production origins from environment variable
if os.getenv("CORS_ORIGINS"):
    production_origins = os.getenv("CORS_ORIGINS").split(",")
    origins.extend([origin.strip() for origin in production_origins])

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=[
        "Accept",
        "Accept-Language", 
        "Content-Language",
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Origin",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers",
    ],
    expose_headers=["*"],
)

# Include routers AFTER middleware setup
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(accounts.router, prefix="/api/accounts", tags=["accounts"])
app.include_router(transactions.router, prefix="/api/transactions", tags=["transactions"])
app.include_router(payees.router, prefix="/api/payees", tags=["payees"])
app.include_router(categories.router, prefix="/api/categories", tags=["categories"])
app.include_router(import_data.router, prefix="/api/import", tags=["import"])

@app.get("/")
def read_root():
    return {"message": "Expense Manager API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/cors-test")
def cors_test():
    """Test endpoint to verify CORS configuration is working"""
    return {
        "message": "CORS is working correctly",
        "timestamp": "2025-08-01",
        "origins": origins
    }

# Test route to verify routing is working
@app.get("/api/test")
def test_api():
    """Test API endpoint"""
    return {"message": "API routing is working", "status": "ok"}