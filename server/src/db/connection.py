import os
from urllib.parse import urlparse
from typing import Optional

from db.database import AsyncDB, PostgresDB, SQLiteDB
from db.migration_runner import apply_migrations
from logging_config import get_logger

logger = get_logger(__name__)

db: Optional[AsyncDB] = None


async def get_db_connection() -> AsyncDB:
    """
    Returns the global database connection instance.
    Raises an exception if the database has not been initialized.
    """
    if db is None:
        raise ConnectionError(
            "Database has not been initialized. Call init_database() first."
        )
    return db


def set_db_connection(new_db: AsyncDB):
    """Sets the global database connection instance, used for testing."""
    global db
    db = new_db


async def init_database():
    """Initializes the database based on environment variables."""
    global db
    if db:
        return

    db_type = os.getenv("DATABASE_TYPE", "sqlite").lower()
    logger.info(f"Initializing database of type: {db_type}")

    if db_type == "postgres":
        db_url = os.environ.get(
            "DATABASE_URL", "postgresql://user:password@localhost:5432/lorecard"
        )
        db = PostgresDB(db_url)
    elif db_type == "sqlite":
        db_url = os.environ.get("DATABASE_URL", "lorecard.db")
        db = SQLiteDB(db_url)
    else:
        raise ValueError(f"Unsupported DATABASE_TYPE: {db_type}")

    await db.connect()
    await apply_migrations(db, db_type)

    # Log a clear confirmation that the database is connected and usable
    try:
        if db_type == "postgres":
            # Get server version information
            row = await db.fetch_one("SELECT version() AS version")
            version = row.get("version") if row else "unknown"

            # Sanitize DATABASE_URL for logging (mask password)
            parsed = urlparse(os.environ.get("DATABASE_URL", ""))
            host = parsed.hostname or "?"
            port = parsed.port or 5432
            dbname = (parsed.path or "/").lstrip("/") or "?"
            logger.info(
                f"Database connected: type=postgres host={host} port={port} db={dbname} version={version}"
            )
        elif db_type == "sqlite":
            row = await db.fetch_one("SELECT sqlite_version() AS version")
            version = row.get("version") if row else "unknown"
            db_path = os.environ.get("DATABASE_URL", "lorecard.db")
            logger.info(
                f"Database connected: type=sqlite file={db_path} version={version}"
            )
    except Exception as e:
        logger.warning(f"Database info log failed: {e}")


async def close_database():
    """Closes the global database connection."""
    global db
    if db:
        await db.disconnect()
        db = None
