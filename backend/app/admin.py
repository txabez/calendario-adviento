from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import admin_token, create_session, require_admin
from app.db import MAX_ATTEMPTS, connect
from app.loaders import YamlError, load_challenges, load_consent, load_days, load_welcome

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


# --- Sesiones de jugador ------------------------------------------------------------
# Cada sesión tiene su propio estado: intentos y días abiertos, y estado de las pruebas.


def check_session(conn, session_id: int):
    if conn.execute("SELECT 1 FROM player_sessions WHERE id = %s", (session_id,)).fetchone() is None:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")


@router.get("/players", summary="Listar sesiones de jugador")
def list_players(username: str = Depends(require_admin)):
    """Sesiones de jugador con un resumen: días abiertos, días bloqueados y pruebas por estado."""
    with connect() as conn:
        players = conn.execute(
            """
            SELECT p.id, p.created_at, p.last_seen_at, p.closed_at,
                   COALESCE((SELECT array_agg(s.day_id ORDER BY s.day_id) FROM session_days s
                             WHERE s.session_id = p.id AND s.unlocked_at IS NOT NULL
                               AND s.attempts_left > 0), '{}') AS unlocked_days,
                   COALESCE((SELECT array_agg(s.day_id ORDER BY s.day_id) FROM session_days s
                             WHERE s.session_id = p.id AND s.attempts_left <= 0), '{}') AS blocked_days,
                   (SELECT count(*) FROM challenge_results r
                    WHERE r.session_id = p.id AND r.status = 'success') AS challenges_success,
                   (SELECT count(*) FROM challenge_results r
                    WHERE r.session_id = p.id AND r.status = 'fail') AS challenges_fail,
                   (SELECT count(*) FROM challenge_results r
                    WHERE r.session_id = p.id AND r.status = 'ignore') AS challenges_ignore
            FROM player_sessions p
            ORDER BY p.closed_at IS NOT NULL, p.last_seen_at DESC
            """
        ).fetchall()
        total = conn.execute("SELECT count(*) AS n FROM challenges").fetchone()["n"]
    return {"challenges_total": total, "players": players}


@router.get("/players/{session_id}", summary="Detalle de una sesión de jugador")
def player_detail(session_id: int, username: str = Depends(require_admin)):
    """Estado de cada día (intentos, abierto, bloqueado) y de cada prueba en esa sesión."""
    with connect() as conn:
        check_session(conn, session_id)
        days = conn.execute(
            """
            SELECT d.id, COALESCE(t.label, d.type) AS type_label,
                   COALESCE(s.attempts_left, %s) AS attempts_left,
                   s.unlocked_at
            FROM days d
            LEFT JOIN day_types t ON t.key = d.type
            LEFT JOIN session_days s ON s.day_id = d.id AND s.session_id = %s
            ORDER BY d.id
            """,
            (MAX_ATTEMPTS, session_id),
        ).fetchall()
        challenges = conn.execute(
            """
            SELECT c.id, r.status, r.updated_at
            FROM challenges c
            LEFT JOIN challenge_results r ON r.challenge_id = c.id AND r.session_id = %s
            ORDER BY c.position
            """,
            (session_id,),
        ).fetchall()
    return {"id": session_id, "max_attempts": MAX_ATTEMPTS, "days": days, "challenges": challenges}


@router.post("/players/{session_id}/days/{day_id}/reset", summary="Resetear un día de una sesión")
def reset_player_day(session_id: int, day_id: int, username: str = Depends(require_admin)):
    """Devuelve al día todos sus intentos en esa sesión (y lo desbloquea). Si ya lo había
    abierto, sigue abierto."""
    with connect() as conn:
        check_session(conn, session_id)
        conn.execute(
            "UPDATE session_days SET attempts_left = %s WHERE session_id = %s AND day_id = %s",
            (MAX_ATTEMPTS, session_id, day_id),
        )
    return {"ok": True}


@router.post("/players/{session_id}/days/{day_id}/block", summary="Bloquear un día de una sesión")
def block_player_day(session_id: int, day_id: int, username: str = Depends(require_admin)):
    """Bloquea el día en esa sesión (le quita todos los intentos), aunque ya lo hubiera
    abierto. Se desbloquea con reset."""
    with connect() as conn:
        check_session(conn, session_id)
        if conn.execute("SELECT 1 FROM days WHERE id = %s", (day_id,)).fetchone() is None:
            raise HTTPException(status_code=404, detail="Día sin contenido")
        conn.execute(
            """
            INSERT INTO session_days (session_id, day_id, attempts_left) VALUES (%s, %s, 0)
            ON CONFLICT (session_id, day_id) DO UPDATE SET attempts_left = 0
            """,
            (session_id, day_id),
        )
    return {"ok": True}


@router.post("/players/{session_id}/challenges/reset", summary="Resetear las pruebas de una sesión")
def reset_player_challenges(session_id: int, username: str = Depends(require_admin)):
    """Borra el estado de todas las pruebas en esa sesión: vuelven a estar pendientes."""
    with connect() as conn:
        check_session(conn, session_id)
        reset = conn.execute(
            "DELETE FROM challenge_results WHERE session_id = %s", (session_id,)
        ).rowcount
    return {"reset": reset}


@router.delete("/players/{session_id}", summary="Cancelar sesión de jugador")
def close_player(session_id: int, username: str = Depends(require_admin)):
    """Cancela una sesión de jugador y borra todo su estado (días y pruebas): tendrá que
    volver a aceptar las condiciones y empezar de cero."""
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


@router.post("/consent/upload", summary="Cargar condiciones (YAML)")
def upload_consent(body: YamlUpload, username: str = Depends(require_admin)):
    """Carga las condiciones de entrada desde el contenido de un YAML (como data/consent.yaml)."""
    return run_loader(load_consent, body.content)


@router.post("/challenges/upload", summary="Cargar pruebas (YAML)")
def upload_challenges(body: YamlUpload, username: str = Depends(require_admin)):
    """Carga el juego de pruebas desde el contenido de un YAML (como data/challenges.yaml).
    Los estados de las pruebas que siguen en el fichero se conservan."""
    return run_loader(load_challenges, body.content)
