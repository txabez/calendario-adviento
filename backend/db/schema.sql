-- Esquema de la base de datos del calendario de adviento.
--
-- Lo ejecuta el backend cada vez que arranca. Todo usa "IF NOT EXISTS", así que
-- volver a ejecutarlo no borra ni duplica nada: solo crea lo que falte.
-- Después de cambiar este fichero, aplícalo reiniciando el backend
-- (desde la carpeta docker/):
--   docker compose restart backend
--
-- Ojo: estos valores también aparecen en backend/app/db.py y deben coincidir:
--   24 días (TOTAL_DAYS) y 10 intentos por día y sesión (MAX_ATTEMPTS).


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
    message       TEXT NOT NULL
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


-- Sesiones de jugador: se crean al aceptar las condiciones (participar y mantener
-- la confidencialidad). created_at es el momento de la aceptación.
-- El navegador guarda el token y lo envía en la cabecera X-Player-Token.
-- El administrador puede cancelarlas desde admin.html.
CREATE TABLE IF NOT EXISTS player_sessions (
    id           SERIAL PRIMARY KEY,
    token        TEXT NOT NULL UNIQUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Cuándo la cerró el jugador (logout). Una sesión cerrada ya no vale, pero se
    -- conserva con su estado para el panel de administración.
    closed_at    TIMESTAMPTZ
);


-- Estado de cada día en cada sesión de jugador. La fila se crea al primer intento:
-- sin fila, el día tiene todos sus intentos y está cerrado.
CREATE TABLE IF NOT EXISTS session_days (
    session_id    INTEGER NOT NULL REFERENCES player_sessions (id) ON DELETE CASCADE,
    day_id        INTEGER NOT NULL REFERENCES days (id) ON DELETE CASCADE,
    attempts_left INTEGER NOT NULL DEFAULT 10,  -- baja con cada fallo; en 0 está bloqueado
    unlocked_at   TIMESTAMPTZ,                  -- cuándo se abrió con la contraseña (NULL: cerrado)
    PRIMARY KEY (session_id, day_id)
);


-- Juego de pruebas (se carga desde data/challenges.yaml con "Cargar pruebas" en admin.html)

-- Textos de la página principal del juego, en filas clave-valor: title, intro, closing
CREATE TABLE IF NOT EXISTS challenges_page (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);


-- Pruebas, en el orden del YAML
CREATE TABLE IF NOT EXISTS challenges (
    id          TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    position    INTEGER NOT NULL
);


-- Estado de cada prueba en cada sesión de jugador. No viene del YAML: lo marcan los
-- jugadores y se conserva al recargarlo (solo se borra si la prueba desaparece del YAML).
CREATE TABLE IF NOT EXISTS challenge_results (
    session_id   INTEGER NOT NULL REFERENCES player_sessions (id) ON DELETE CASCADE,
    challenge_id TEXT NOT NULL REFERENCES challenges (id) ON DELETE CASCADE,
    status       TEXT NOT NULL CHECK (status IN ('success', 'fail', 'ignore')),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (session_id, challenge_id)
);


-- Condiciones que hay que aceptar al entrar (se cargan desde data/consent.yaml con
-- "Cargar condiciones" en admin.html)

-- Textos del diálogo y de la página de rechazo, en filas clave-valor:
--   title, intro, rejected_title, rejected_text
CREATE TABLE IF NOT EXISTS consent_page (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);


-- Cada condición (una casilla), en el orden del YAML
CREATE TABLE IF NOT EXISTS consent_conditions (
    position INTEGER PRIMARY KEY,
    text     TEXT NOT NULL
);
