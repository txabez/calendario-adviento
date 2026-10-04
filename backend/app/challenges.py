"""Juego de pruebas: endpoints. El YAML se carga desde el panel (app/admin.py)."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import connect
from app.player import find_session, player_token

router = APIRouter(prefix="/api/challenges", tags=["Pruebas"])


@router.get("", summary="Juego de pruebas")
def get_challenges(token: str = Depends(player_token)):
    """Título, explicación, cierre (opcional) y lista de pruebas (en orden) con su estado
    en esta sesión de jugador (null si no se ha marcado o no hay sesión)."""
    with connect() as conn:
        session_id = find_session(conn, token)
        page = {
            row["key"]: row["value"]
            for row in conn.execute("SELECT key, value FROM challenges_page").fetchall()
        }
        challenges = conn.execute(
            """
            SELECT c.id, r.status
            FROM challenges c
            LEFT JOIN challenge_results r ON r.challenge_id = c.id AND r.session_id = %s
            ORDER BY c.position
            """,
            (session_id,),
        ).fetchall()
    if not page:
        raise HTTPException(status_code=404, detail="Juego de pruebas sin contenido")
    return {
        "title": page.get("title"),
        "intro": page.get("intro"),
        "closing": page.get("closing"),
        "challenges": challenges,
    }


@router.get("/{challenge_id}", summary="Una prueba")
def get_challenge(challenge_id: str, token: str = Depends(player_token)):
    """Descripción de la prueba y su estado en esta sesión de jugador."""
    with connect() as conn:
        session_id = find_session(conn, token)
        challenge = conn.execute(
            """
            SELECT c.id, c.description, r.status
            FROM challenges c
            LEFT JOIN challenge_results r ON r.challenge_id = c.id AND r.session_id = %s
            WHERE c.id = %s
            """,
            (session_id, challenge_id),
        ).fetchone()
    if challenge is None:
        raise HTTPException(status_code=404, detail="Prueba no encontrada")
    return challenge


class StatusUpdate(BaseModel):
    status: Literal["success", "fail", "ignore"]


@router.put("/{challenge_id}/status", summary="Marcar el estado de una prueba")
def set_status(challenge_id: str, body: StatusUpdate, token: str = Depends(player_token)):
    """Guarda el estado en esta sesión de jugador: success (superada), fail (fallida)
    o ignore (ignorada). Sin sesión responde 403."""
    with connect() as conn:
        session_id = find_session(conn, token)
        if session_id is None:
            raise HTTPException(status_code=403, detail="Hay que aceptar las condiciones")
        exists = conn.execute("SELECT 1 FROM challenges WHERE id = %s", (challenge_id,)).fetchone()
        if exists is None:
            raise HTTPException(status_code=404, detail="Prueba no encontrada")
        conn.execute(
            """
            INSERT INTO challenge_results (session_id, challenge_id, status) VALUES (%s, %s, %s)
            ON CONFLICT (session_id, challenge_id)
            DO UPDATE SET status = EXCLUDED.status, updated_at = now()
            """,
            (session_id, challenge_id, body.status),
        )
    return {"id": challenge_id, "status": body.status}
