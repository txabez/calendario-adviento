"""Juego de pruebas: endpoints. El YAML se carga desde el panel (app/admin.py)."""
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db import connect

router = APIRouter(prefix="/api/challenges", tags=["Pruebas"])


@router.get("", summary="Juego de pruebas")
def get_challenges():
    """Título, explicación y lista de pruebas (en orden) con su estado."""
    with connect() as conn:
        page = {
            row["key"]: row["value"]
            for row in conn.execute("SELECT key, value FROM challenges_page").fetchall()
        }
        challenges = conn.execute(
            """
            SELECT c.id, r.status
            FROM challenges c LEFT JOIN challenge_results r ON r.challenge_id = c.id
            ORDER BY c.position
            """
        ).fetchall()
    if not page:
        raise HTTPException(status_code=404, detail="Juego de pruebas sin contenido")
    return {"title": page.get("title"), "intro": page.get("intro"), "challenges": challenges}


@router.get("/{challenge_id}", summary="Una prueba")
def get_challenge(challenge_id: str):
    """Descripción de la prueba y su estado (null si aún no se ha marcado)."""
    with connect() as conn:
        challenge = conn.execute(
            """
            SELECT c.id, c.description, r.status
            FROM challenges c LEFT JOIN challenge_results r ON r.challenge_id = c.id
            WHERE c.id = %s
            """,
            (challenge_id,),
        ).fetchone()
    if challenge is None:
        raise HTTPException(status_code=404, detail="Prueba no encontrada")
    return challenge


class StatusUpdate(BaseModel):
    status: Literal["success", "fail", "ignore"]


@router.put("/{challenge_id}/status", summary="Marcar el estado de una prueba")
def set_status(challenge_id: str, body: StatusUpdate):
    """Guarda el estado: success (superada), fail (fallida) o ignore (ignorada)."""
    with connect() as conn:
        exists = conn.execute("SELECT 1 FROM challenges WHERE id = %s", (challenge_id,)).fetchone()
        if exists is None:
            raise HTTPException(status_code=404, detail="Prueba no encontrada")
        conn.execute(
            """
            INSERT INTO challenge_results (challenge_id, status) VALUES (%s, %s)
            ON CONFLICT (challenge_id) DO UPDATE SET status = EXCLUDED.status, updated_at = now()
            """,
            (challenge_id, body.status),
        )
    return {"id": challenge_id, "status": body.status}
