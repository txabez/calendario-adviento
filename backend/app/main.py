import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

from app.admin import router as admin_router
from app.auth import sync_admin
from app.challenges import router as challenges_router
from app.db import MAX_ATTEMPTS, TOTAL_DAYS, connect, init_db
from app.player import create_session, find_session, is_unlocked, mark_unlocked, player_token


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    sync_admin()
    yield


app = FastAPI(
    title="Adviento API",
    description=(
        "API del calendario de adviento.\n\n"
        "Para probar los endpoints de **Administración**: llama a `POST /api/admin/login`, "
        "copia el `token` y pégalo en **Authorize → Administrador**.\n\n"
        "Para simular a un jugador que ya abrió días, pega su `player_token` "
        "en **Authorize → Jugador**."
    ),
    lifespan=lifespan,
    # Bajo /api para que también se vean a través del proxy del frontend (puerto 5173)
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    openapi_tags=[
        {"name": "Jugador", "description": "Lo que usa la app: bienvenida y días."},
        {"name": "Pruebas", "description": "Juego de pruebas: explicación, pruebas y su estado."},
        {"name": "Administración", "description": "Panel de admin.html. Requiere token."},
        {"name": "Sistema", "description": "Estado del servicio."},
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin_router)
app.include_router(challenges_router)


@app.get("/api/health", tags=["Sistema"], summary="Estado del backend y la base de datos")
def health():
    with connect() as conn:
        version = conn.execute("SELECT version() AS v").fetchone()["v"]
    return {"status": "ok", "db": version}


@app.get("/api/welcome", tags=["Jugador"], summary="Contenido de la bienvenida")
def get_welcome():
    """Contenido de la página de bienvenida, montado a partir de sus filas clave-valor."""
    with connect() as conn:
        rows = conn.execute("SELECT key, value FROM welcome").fetchall()
    if not rows:
        raise HTTPException(status_code=404, detail="Bienvenida sin contenido")

    values = {row["key"]: row["value"] for row in rows}
    section_keys = sorted(
        (k for k in values if k.startswith("section_")), key=lambda k: int(k.split("_")[1])
    )
    return {
        "title": values.get("title"),
        "subtitle": values.get("subtitle"),
        "intro": values.get("intro"),
        "sections": [values[k] for k in section_keys],
    }


class Unlock(BaseModel):
    password: str


def check_day_id(day_id: int):
    if not 1 <= day_id <= TOTAL_DAYS:
        raise HTTPException(status_code=404, detail="Día fuera del calendario")


def blocked():
    return HTTPException(status_code=423, detail="Día bloqueado")


DAY_QUERY = """
    SELECT d.id, d.password, d.message, d.attempts_left,
           d.type, t.label AS type_label, t.image AS type_image
    FROM days d LEFT JOIN day_types t ON t.key = d.type
    WHERE d.id = %s
"""


def day_content(day):
    """Lo que ve el jugador de un día abierto."""
    return {
        "id": day["id"],
        "message": day["message"],
        "type": {"key": day["type"], "label": day["type_label"] or day["type"], "image": day["type_image"]},
    }


@app.get("/api/days/{day_id}", tags=["Jugador"], summary="Estado de un día")
def day_status(day_id: int, token: str = Depends(player_token)):
    """Estado del día. Si esta sesión de jugador ya lo abrió, incluye su contenido."""
    check_day_id(day_id)
    with connect() as conn:
        day = conn.execute(DAY_QUERY, (day_id,)).fetchone()
        if day is None:
            raise HTTPException(status_code=404, detail="Día sin contenido")
        blocked = day["attempts_left"] <= 0
        # Un día bloqueado no se muestra aunque esta sesión ya lo hubiera abierto
        unlocked = not blocked and is_unlocked(conn, find_session(conn, token), day_id)
    return {
        "id": day_id,
        "attempts_left": day["attempts_left"],
        "max_attempts": MAX_ATTEMPTS,
        "blocked": blocked,
        "unlocked": unlocked,
        "content": day_content(day) if unlocked else None,
    }


@app.post("/api/days/{day_id}/unlock", tags=["Jugador"], summary="Abrir un día con su contraseña")
def unlock_day(day_id: int, body: Unlock, token: str = Depends(player_token)):
    """Devuelve el contenido del día si la contraseña es correcta y lo deja desbloqueado
    para la sesión de jugador (que se crea si no existe; su token va en la respuesta).

    Cada contraseña incorrecta resta un intento; sin intentos el día queda bloqueado.
    """
    check_day_id(day_id)
    with connect() as conn:
        day = conn.execute(DAY_QUERY, (day_id,)).fetchone()
        if day is None:
            raise HTTPException(status_code=404, detail="Día sin contenido")
        if day["attempts_left"] <= 0:
            raise blocked()
        if body.password.strip() != day["password"]:
            row = conn.execute(
                """
                UPDATE days SET attempts_left = attempts_left - 1
                WHERE id = %s AND attempts_left > 0
                RETURNING attempts_left
                """,
                (day_id,),
            ).fetchone()
            conn.commit()
            if row is None or row["attempts_left"] <= 0:
                raise blocked()
            raise HTTPException(
                status_code=401,
                detail={"message": "Contraseña incorrecta", "attempts_left": row["attempts_left"]},
            )

        session_id = find_session(conn, token)
        if session_id is None:
            session_id, token = create_session(conn)
        mark_unlocked(conn, session_id, day_id)
    return {**day_content(day), "player_token": token}
