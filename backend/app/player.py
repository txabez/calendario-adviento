"""Sesiones de jugador.

Se crean al aceptar las condiciones. Cada sesión tiene su propio estado: los
intentos de contraseña y los días abiertos (session_days) y el estado de las
pruebas (challenge_results).
"""
import secrets

from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security import APIKeyHeader
from pydantic import BaseModel

from app.db import MAX_ATTEMPTS, connect

# Declarado como esquema de seguridad para que /api/docs permita indicarlo en "Authorize"
player_header = APIKeyHeader(
    name="X-Player-Token",
    auto_error=False,
    scheme_name="Jugador",
    description="Token de jugador que devuelve POST /api/player/session al aceptar las condiciones",
)


def player_token(token: str | None = Security(player_header)) -> str:
    """Dependencia de FastAPI: token de jugador enviado en la cabecera X-Player-Token."""
    return (token or "").strip()


def find_session(conn, token: str):
    """Id de la sesión abierta de ese token (y actualiza su última actividad), o None.
    Una sesión cerrada por el jugador ya no vale."""
    if not token:
        return None
    row = conn.execute(
        """
        UPDATE player_sessions SET last_seen_at = now()
        WHERE token = %s AND closed_at IS NULL
        RETURNING id
        """,
        (token,),
    ).fetchone()
    return row["id"] if row else None


def create_session(conn):
    token = secrets.token_urlsafe(32)
    row = conn.execute(
        "INSERT INTO player_sessions (token) VALUES (%s) RETURNING id", (token,)
    ).fetchone()
    return row["id"], token


def day_state(conn, session_id, day_id: int) -> dict:
    """Intentos restantes, si está bloqueado y si está abierto, para esa sesión.
    Sin sesión (o sin fila todavía): todos los intentos y cerrado."""
    row = None
    if session_id is not None:
        row = conn.execute(
            "SELECT attempts_left, unlocked_at FROM session_days WHERE session_id = %s AND day_id = %s",
            (session_id, day_id),
        ).fetchone()
    attempts_left = row["attempts_left"] if row else MAX_ATTEMPTS
    blocked = attempts_left <= 0
    # Un día bloqueado no se muestra aunque la sesión ya lo hubiera abierto
    unlocked = bool(row and row["unlocked_at"]) and not blocked
    return {"attempts_left": attempts_left, "blocked": blocked, "unlocked": unlocked}


def fail_attempt(conn, session_id: int, day_id: int) -> int:
    """Resta un intento a ese día en esa sesión. Devuelve los intentos que quedan."""
    row = conn.execute(
        """
        INSERT INTO session_days (session_id, day_id, attempts_left) VALUES (%s, %s, %s)
        ON CONFLICT (session_id, day_id) DO UPDATE
        SET attempts_left = GREATEST(session_days.attempts_left - 1, 0)
        RETURNING attempts_left
        """,
        (session_id, day_id, MAX_ATTEMPTS - 1),
    ).fetchone()
    return row["attempts_left"]


def mark_unlocked(conn, session_id: int, day_id: int):
    conn.execute(
        """
        INSERT INTO session_days (session_id, day_id, unlocked_at) VALUES (%s, %s, now())
        ON CONFLICT (session_id, day_id) DO UPDATE
        SET unlocked_at = COALESCE(session_days.unlocked_at, now())
        """,
        (session_id, day_id),
    )


# --- Endpoints ----------------------------------------------------------------------

router = APIRouter(prefix="/api/player", tags=["Jugador"])


@router.get("/consent", summary="Condiciones de entrada")
def get_consent():
    """Textos del diálogo de condiciones y de la página de rechazo, y las condiciones
    (cada una con su id, que hay que enviar al aceptarla)."""
    with connect() as conn:
        page = {
            row["key"]: row["value"]
            for row in conn.execute("SELECT key, value FROM consent_page").fetchall()
        }
        conditions = conn.execute(
            "SELECT position AS id, text FROM consent_conditions ORDER BY position"
        ).fetchall()
    return {
        "title": page.get("title"),
        "intro": page.get("intro"),
        "conditions": conditions,
        "rejected": {"title": page.get("rejected_title"), "text": page.get("rejected_text")},
    }


class Consent(BaseModel):
    accepted: list[int]  # ids de las condiciones aceptadas (GET /api/player/consent)


@router.post("/session", summary="Aceptar las condiciones y crear la sesión de jugador")
def accept(body: Consent):
    """Crea la sesión de jugador si se aceptan todas las condiciones. Devuelve su token,
    que el navegador envía después en la cabecera X-Player-Token."""
    with connect() as conn:
        required = {
            row["position"] for row in conn.execute("SELECT position FROM consent_conditions").fetchall()
        }
        if not required.issubset(body.accepted):
            raise HTTPException(status_code=400, detail="Hay que aceptar todas las condiciones")
        _, token = create_session(conn)
    return {"player_token": token}


@router.get("/session", summary="Comprobar la sesión de jugador")
def check(token: str = Depends(player_token)):
    """Indica si el token es de una sesión abierta (las condiciones ya se aceptaron) y,
    si lo es, su número y cuándo se aceptaron las condiciones."""
    with connect() as conn:
        session_id = find_session(conn, token)
        if session_id is None:
            return {"valid": False}
        row = conn.execute(
            "SELECT created_at FROM player_sessions WHERE id = %s", (session_id,)
        ).fetchone()
    return {"valid": True, "id": session_id, "created_at": row["created_at"]}


@router.delete("/session", summary="Cerrar la sesión de jugador (logout)")
def logout(token: str = Depends(player_token)):
    """Cierra la sesión: el token deja de valer y habrá que volver a aceptar las
    condiciones. La sesión se conserva (cerrada) con su estado para el administrador."""
    with connect() as conn:
        session_id = find_session(conn, token)
        if session_id is None:
            raise HTTPException(status_code=403, detail="No hay ninguna sesión abierta")
        conn.execute("UPDATE player_sessions SET closed_at = now() WHERE id = %s", (session_id,))
    return {"ok": True}
