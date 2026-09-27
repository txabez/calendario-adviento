"""Sesiones de jugador: recuerdan qué días se han abierto ya con la contraseña correcta."""
import secrets

from fastapi import Security
from fastapi.security import APIKeyHeader

# Declarado como esquema de seguridad para que /api/docs permita indicarlo en "Authorize"
player_header = APIKeyHeader(
    name="X-Player-Token",
    auto_error=False,
    scheme_name="Jugador",
    description="Token de jugador que devuelve POST /api/days/{day_id}/unlock (opcional)",
)


def player_token(token: str | None = Security(player_header)) -> str:
    """Dependencia de FastAPI: token de jugador enviado en la cabecera X-Player-Token."""
    return (token or "").strip()


def find_session(conn, token: str):
    """Id de la sesión de ese token (y actualiza su última actividad), o None."""
    if not token:
        return None
    row = conn.execute(
        "UPDATE player_sessions SET last_seen_at = now() WHERE token = %s RETURNING id",
        (token,),
    ).fetchone()
    return row["id"] if row else None


def create_session(conn):
    token = secrets.token_urlsafe(32)
    row = conn.execute(
        "INSERT INTO player_sessions (token) VALUES (%s) RETURNING id", (token,)
    ).fetchone()
    return row["id"], token


def is_unlocked(conn, session_id, day_id: int) -> bool:
    if session_id is None:
        return False
    return (
        conn.execute(
            "SELECT 1 FROM unlocked_days WHERE session_id = %s AND day_id = %s",
            (session_id, day_id),
        ).fetchone()
        is not None
    )


def mark_unlocked(conn, session_id: int, day_id: int):
    conn.execute(
        "INSERT INTO unlocked_days (session_id, day_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
        (session_id, day_id),
    )
