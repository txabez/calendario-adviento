import hashlib
import hmac
import logging
import secrets
from pathlib import Path

import yaml
from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.db import connect

# Horas que dura una sesión de administrador
SESSION_HOURS = 12

ADMIN_FILE = Path(__file__).resolve().parent.parent / "data" / "admin.yaml"

log = logging.getLogger("uvicorn.error")


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    salt, digest = stored.split("$")
    candidate = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=2**14, r=8, p=1)
    return hmac.compare_digest(candidate.hex(), digest)


def sync_admin(path: Path = ADMIN_FILE):
    """Carga el administrador de data/admin.yaml en la base de datos (se llama al arrancar).

    Si el usuario y la contraseña no han cambiado no hace nada, para no cerrar
    las sesiones abiertas. Si han cambiado, sustituye al administrador anterior
    y cierra sus sesiones.
    """
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except (OSError, yaml.YAMLError) as e:
        log.error("No se ha podido leer %s: %s", path, e)
        return

    for field in ("username", "password"):
        value = data.get(field)
        if not isinstance(value, str) or not value.strip():
            log.error(
                "%s: '%s' falta o no es un texto (si es solo números, ponlo entre comillas)",
                path, field,
            )
            return
    username = data["username"].strip()
    password = data["password"].strip()

    with connect() as conn:
        admins = conn.execute("SELECT username, password_hash FROM admins").fetchall()
        if (
            len(admins) == 1
            and admins[0]["username"] == username
            and verify_password(password, admins[0]["password_hash"])
        ):
            return
        conn.execute("DELETE FROM admins")  # también borra sus sesiones (ON DELETE CASCADE)
        conn.execute(
            "INSERT INTO admins (username, password_hash) VALUES (%s, %s)",
            (username, hash_password(password)),
        )
    log.info("Administrador '%s' cargado desde %s", username, path)


def create_session(username: str, password: str) -> str | None:
    """Comprueba usuario y contraseña; si son correctos, abre una sesión y devuelve su token."""
    with connect() as conn:
        admin = conn.execute(
            "SELECT password_hash FROM admins WHERE username = %s", (username,)
        ).fetchone()
        if admin is None or not verify_password(password, admin["password_hash"]):
            return None
        token = secrets.token_urlsafe(32)
        conn.execute(
            "INSERT INTO admin_sessions (token, username) VALUES (%s, %s)", (token, username)
        )
    return token


# Declarado como esquema de seguridad para que /api/docs muestre el botón "Authorize"
admin_bearer = HTTPBearer(
    auto_error=False,
    scheme_name="Administrador",
    description="Token que devuelve POST /api/admin/login",
)


def admin_token(credentials: HTTPAuthorizationCredentials | None = Security(admin_bearer)) -> str:
    return credentials.credentials if credentials else ""


def require_admin(token: str = Security(admin_token)) -> str:
    """Dependencia de FastAPI: exige 'Authorization: Bearer <token>' de una sesión válida."""
    if token:
        with connect() as conn:
            conn.execute(
                "DELETE FROM admin_sessions WHERE created_at < now() - make_interval(hours => %s)",
                (SESSION_HOURS,),
            )
            session = conn.execute(
                "SELECT username FROM admin_sessions WHERE token = %s", (token,)
            ).fetchone()
        if session:
            return session["username"]
    raise HTTPException(status_code=401, detail="Sesión no válida")
