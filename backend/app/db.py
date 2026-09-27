import os
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://adviento:adviento@localhost:5432/adviento"
)

# El esquema (tablas, restricciones...) está en SQL, fuera del código
SCHEMA_FILE = Path(__file__).resolve().parent.parent / "db" / "schema.sql"

# Estos valores también están en db/schema.sql y deben coincidir con él
TOTAL_DAYS = 24

# Intentos de contraseña por día antes de bloquearlo
MAX_ATTEMPTS = 10


def connect():
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


def init_db():
    """Aplica db/schema.sql (se llama al arrancar el backend)."""
    with connect() as conn:
        conn.execute(SCHEMA_FILE.read_text(encoding="utf-8"))
