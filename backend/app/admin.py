from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import admin_token, create_session, require_admin
from app.db import MAX_ATTEMPTS, connect
from app.loaders import YamlError, load_days, load_welcome

router = APIRouter(prefix="/api/admin", tags=["Administración"])


class YamlUpload(BaseModel):
    content: str


def run_loader(loader, content):
    try:
        return loader(content)
    except YamlError as e:
        raise HTTPException(status_code=400, detail={"errors": e.errors}) from e


class Login(BaseModel):
    username: str
    password: str


@router.post("/login", summary="Iniciar sesión")
def login(body: Login):
    """Devuelve un token de sesión. Pégalo en **Authorize → Administrador** para probar el resto."""
    token = create_session(body.username.strip(), body.password)
    if token is None:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
    return {"token": token}


@router.post("/logout", summary="Cerrar sesión")
def logout(username: str = Depends(require_admin), token: str = Depends(admin_token)):
    """Invalida el token de administrador usado en la petición."""
    with connect() as conn:
        conn.execute("DELETE FROM admin_sessions WHERE token = %s", (token,))
    return {"ok": True}


@router.get("/days", summary="Listar días")
def list_days(username: str = Depends(require_admin)):
    """Días con su tipo e intentos restantes."""
    with connect() as conn:
        days = conn.execute(
            """
            SELECT d.id, d.attempts_left, COALESCE(t.label, d.type) AS type_label
            FROM days d LEFT JOIN day_types t ON t.key = d.type
            ORDER BY d.id
            """
        ).fetchall()
    return {"max_attempts": MAX_ATTEMPTS, "days": days}


@router.post("/days/{day_id}/reset", summary="Resetear día")
def reset_day(day_id: int, username: str = Depends(require_admin)):
    """Devuelve al día todos sus intentos (y lo desbloquea si estaba bloqueado)."""
    with connect() as conn:
        day = conn.execute(
            "UPDATE days SET attempts_left = %s WHERE id = %s RETURNING id, attempts_left",
            (MAX_ATTEMPTS, day_id),
        ).fetchone()
    if day is None:
        raise HTTPException(status_code=404, detail="Día sin contenido")
    return day


@router.post("/days/{day_id}/block", summary="Bloquear día")
def block_day(day_id: int, username: str = Depends(require_admin)):
    """Bloquea el día (le quita todos los intentos), también para quien ya lo había abierto.
    Se desbloquea con reset."""
    with connect() as conn:
        day = conn.execute(
            "UPDATE days SET attempts_left = 0 WHERE id = %s RETURNING id, attempts_left",
            (day_id,),
        ).fetchone()
    if day is None:
        raise HTTPException(status_code=404, detail="Día sin contenido")
    return day


@router.get("/players", summary="Listar sesiones de jugador")
def list_players(username: str = Depends(require_admin)):
    """Sesiones de jugador con los días que han desbloqueado."""
    with connect() as conn:
        players = conn.execute(
            """
            SELECT p.id, p.created_at, p.last_seen_at,
                   COALESCE(array_agg(u.day_id ORDER BY u.day_id)
                            FILTER (WHERE u.day_id IS NOT NULL), '{}') AS unlocked_days
            FROM player_sessions p LEFT JOIN unlocked_days u ON u.session_id = p.id
            GROUP BY p.id
            ORDER BY p.last_seen_at DESC
            """
        ).fetchall()
    return {"players": players}


@router.delete("/players/{session_id}", summary="Cancelar sesión de jugador")
def close_player(session_id: int, username: str = Depends(require_admin)):
    """Cancela una sesión de jugador: sus días vuelven a pedir contraseña."""
    with connect() as conn:
        deleted = conn.execute(
            "DELETE FROM player_sessions WHERE id = %s", (session_id,)
        ).rowcount
    if not deleted:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    return {"ok": True}


@router.post("/days/upload", summary="Cargar días (YAML)")
def upload_days(body: YamlUpload, username: str = Depends(require_admin)):
    """Carga los días desde el contenido de un YAML (como data/days.yaml)."""
    return run_loader(load_days, body.content)


@router.post("/welcome/upload", summary="Cargar bienvenida (YAML)")
def upload_welcome(body: YamlUpload, username: str = Depends(require_admin)):
    """Carga la bienvenida desde el contenido de un YAML (como data/welcome.yaml)."""
    return run_loader(load_welcome, body.content)
