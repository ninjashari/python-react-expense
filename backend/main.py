from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import accounts, transactions, payees, categories, reports, import_data, auth
import models

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Expense Manager API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(accounts.router, prefix="/api/accounts", tags=["accounts"])
app.include_router(transactions.router, prefix="/api/transactions", tags=["transactions"])
app.include_router(payees.router, prefix="/api/payees", tags=["payees"])
app.include_router(categories.router, prefix="/api/categories", tags=["categories"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(import_data.router, prefix="/api/import", tags=["import"])

@app.get("/")
def read_root():
    return {"message": "Expense Manager API"}