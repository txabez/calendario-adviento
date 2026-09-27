-- Esquema de la base de datos del calendario de adviento.
--
-- Lo ejecuta el backend cada vez que arranca. Todo usa "IF NOT EXISTS", así que
-- volver a ejecutarlo no borra ni duplica nada: solo crea lo que falte.
-- Después de cambiar este fichero, aplícalo reiniciando el backend
-- (desde la carpeta docker/):
--   docker compose restart backend
--
-- Ojo: estos valores también aparecen en backend/app/db.py y deben coincidir:
--   24 días (TOTAL_DAYS) y 10 intentos (MAX_ATTEMPTS).


-- Tipos de día (se cargan desde la sección "types" de data/days.yaml)
CREATE TABLE IF NOT EXISTS day_types (
    key   TEXT PRIMARY KEY,
    label TEXT NOT NULL,   -- nombre que se muestra
    image TEXT             -- fichero de frontend/public/images/ (opcional)
);


-- Días del calendario (se cargan desde data/days.yaml con "Cargar días" en admin.html)
CREATE TABLE IF NOT EXISTS days (
    id            INTEGER PRIMARY KEY CHECK (id BETWEEN 1 AND 24),
    password      TEXT NOT NULL,
    type          TEXT NOT NULL,   -- clave de day_types
    message       TEXT NOT NULL,
    -- Intentos de contraseña restantes: no viene del YAML, empieza en 10 y baja con cada fallo
    attempts_left INTEGER NOT NULL DEFAULT 10
);


-- Página de bienvenida (se carga desde data/welcome.yaml con "Cargar bienvenida"),
-- en filas clave-valor:
--   title, subtitle, intro  -> texto
--   section_1, section_2... -> encabezado y contenido de cada sección, en orden
CREATE TABLE IF NOT EXISTS welcome (
    key   TEXT PRIMARY KEY,
    value JSONB NOT NULL
);


-- Administradores (se cargan desde data/admin.yaml al arrancar el backend)
CREATE TABLE IF NOT EXISTS admins (
    username      TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL
);


-- Sesiones abiertas desde admin.html (se borran al cambiar el administrador)
CREATE TABLE IF NOT EXISTS admin_sessions (
    token      TEXT PRIMARY KEY,
    username   TEXT NOT NULL REFERENCES admins (username) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- Sesiones de jugador: se crean al abrir el primer día con la contraseña correcta.
-- El navegador guarda el token y lo envía en la cabecera X-Player-Token.
-- El administrador puede cancelarlas desde admin.html.
CREATE TABLE IF NOT EXISTS player_sessions (
    id           SERIAL PRIMARY KEY,
    token        TEXT NOT NULL UNIQUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- Días desbloqueados por cada sesión de jugador (ya no piden la contraseña)
CREATE TABLE IF NOT EXISTS unlocked_days (
    session_id  INTEGER NOT NULL REFERENCES player_sessions (id) ON DELETE CASCADE,
    day_id      INTEGER NOT NULL REFERENCES days (id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (session_id, day_id)
);
