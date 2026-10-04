import os

# Per-router read-path flag for the Postgres -> Mongo cutover (see the staged
# migration plan). "postgres" (default) keeps reads on the existing SQLAlchemy
# path; a router flips to "mongo" only after its shadow-compare verification
# passes. Writes are unaffected by this flag - Postgres remains the write
# source of truth until the final Postgres-removal stage.
READ_SOURCE = os.getenv("READ_SOURCE", "postgres")
