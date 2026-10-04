# Calendario de Adviento

Calendario de adviento web y personalizable: una página de bienvenida, un calendario de 24 días y una página por día protegida con su propia contraseña. Todo el contenido (textos, contraseñas, tipos de día e imágenes) se define en ficheros YAML y se carga desde un panel de administración, sin tocar código.

## Características

- **Bienvenida** con título, introducción y secciones (instrucciones, normas…) editables desde YAML.
- **Calendario de 24 días**: cada día se abre con su contraseña.
- **Tipos de día configurables** (nombre e imagen), definidos en el YAML de días.
- **10 intentos por día**: al agotarlos, el día queda bloqueado. El contador aparece a partir del primer fallo.
- **Sesión de jugador**: los días ya abiertos no vuelven a pedir la contraseña en ese navegador.
- **Panel de administración** (`admin.html`):
  - cargar los YAML de días y de bienvenida;
  - resetear o bloquear un día;
  - ver y cancelar sesiones de jugador.
- **Juego de pruebas** (`/pruebas`), independiente del calendario: una página de explicación, un botón por prueba (tantas como tenga el YAML) y en cada prueba los botones **Superada**, **Fallida** e **Ignorar**. El estado se guarda en la base de datos.
- **API documentada con OpenAPI** (Swagger UI) para ver y probar los endpoints.
- Interfaz moderna y animada (componentes de shadcn/ui y animaciones con Motion), adaptada a móvil y con temas de color que se eligen al arrancar.

## Stack

| Parte | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript + Vite + React Router, Tailwind CSS v4 + shadcn/ui, Motion, iconos Lucide |
| Backend | FastAPI (Python 3.12) + psycopg 3 |
| Base de datos | PostgreSQL 17 |
| Entorno | Docker Compose (red `adviento`) |

## Estructura

```
.
├── docker/
│   ├── docker-compose.yaml      # los 3 contenedores: db, backend y frontend
│   ├── backend/Dockerfile
│   └── frontend/Dockerfile
├── backend/
│   ├── app/
│   │   ├── main.py              # app FastAPI y endpoints del jugador
│   │   ├── admin.py             # endpoints de administración
│   │   ├── auth.py              # sesiones de admin y carga de admin.yaml
│   │   ├── player.py            # sesiones de jugador
│   │   ├── loaders.py           # validación y carga de los YAML
│   │   └── db.py                # conexión y aplicación del esquema
│   ├── db/schema.sql            # esquema de la base de datos
│   ├── data/                    # YAML de contenido (no se sube al repo)
│   └── requirements.txt
└── frontend/
    ├── index.html               # app: bienvenida, calendario, días y juego de pruebas
    ├── admin.html               # panel de administración
    ├── components.json          # configuración de shadcn/ui
    ├── public/images/           # imágenes de los tipos de día (no se suben al repo)
    └── src/
        ├── pages/               # Welcome, Calendar, Day, Admin y challenges/
        ├── components/          # componentes propios (Page, RichText, PasswordInput…)
        │   └── ui/              # componentes de shadcn/ui
        ├── lib/                 # clientes de la API (api.ts, admin-api.ts) y utilidades
        └── styles/
            ├── index.css        # Tailwind y conexión de las variables del tema
            └── themes/          # un fichero por tema (colores y tipografías)
```

## Puesta en marcha

Requisitos: Docker con Docker Compose.

1. Clona el repositorio.
2. Crea la carpeta `backend/data/` con los tres YAML. Los formatos están en [Contenido](#contenido). Esta carpeta está en `.gitignore` porque contiene las contraseñas y los textos.
3. Crea la carpeta `frontend/public/images/` y pon en ella las imágenes de los tipos de día que uses en `days.yaml`. Tampoco se sube al repo. Son opcionales: un tipo sin imagen muestra solo su nombre.
4. Levanta los contenedores:

   ```bash
   cd docker
   docker compose up -d --build
   ```

5. Entra en http://localhost:5173/admin.html con el usuario de `admin.yaml` y carga `days.yaml`, `welcome.yaml` y `challenges.yaml` con los botones **Cargar días**, **Cargar bienvenida** y **Cargar pruebas**.

| Servicio | URL local | Dentro de la red `adviento` |
|---|---|---|
| App | http://localhost:5173 | `frontend:5173` |
| Panel de administración | http://localhost:5173/admin.html | |
| Juego de pruebas | http://localhost:5173/pruebas | |
| API | http://localhost:8000 | `backend:8000` |
| Documentación de la API | http://localhost:8000/api/docs | |
| PostgreSQL | `localhost:5432` | `db:5432` |

Comandos útiles (desde `docker/`):

```bash
docker compose logs -f backend   # ver logs del backend
docker compose restart backend   # aplicar cambios de admin.yaml o schema.sql
docker compose down              # parar
docker compose down -v           # parar y borrar la base de datos
```

Las credenciales de PostgreSQL son `adviento` / `adviento` / `adviento` por defecto. Se pueden cambiar con un fichero `docker/.env` que defina `POSTGRES_USER`, `POSTGRES_PASSWORD` y `POSTGRES_DB`.

El código de `frontend/` y `backend/` está montado en los contenedores y se recarga solo al editarlo.

## Contenido

Todo el contenido vive en `backend/data/`.

### `admin.yaml`: usuario del panel

Se carga al arrancar el backend. Después de cambiarlo, ejecuta `docker compose restart backend`.

```yaml
username: admin
password: "una-contraseña-segura"
```

### `days.yaml`: tipos de día y días

Se carga desde el panel con **Cargar días**. Cada imagen tiene que existir en `frontend/public/images/`.

```yaml
types:
  - key: sorpresa
    label: Sorpresa
    image: sorpresa.webp        # opcional

  - key: actividad
    label: Actividad
    image: actividad.webp

days:
  - id: 1                       # del 1 al 24
    password: "Turron24!"       # entre comillas si lleva # & : o son solo números
    type: sorpresa              # una de las claves de "types"
    message: |
      Busca debajo del árbol: hay un paquete con tu nombre.
      Con "|" se respetan los saltos de línea.

  - id: 2
    password: "Reno#2026"
    type: actividad
    message: |
      Hoy toca decorar galletas de jengibre juntos.
```

Al cargar el YAML, las tablas quedan exactamente como el fichero: los días que no aparecen se borran. Los intentos restantes de cada día se conservan.

### `welcome.yaml`: página de bienvenida

Se carga desde el panel con **Cargar bienvenida**.

```yaml
title: Calendario Adviento
subtitle: Edición 2026
intro: >
  Texto de introducción bajo el título.

sections:
  - heading: Instrucciones
    content:
      - text: Un párrafo.
      - list:
          - "**En negrita:** los asteriscos dobles marcan negrita"
          - "Un enlace: [texto que se ve](https://ejemplo.com)"
          - Otro elemento de la lista
```

Si un YAML tiene errores, el panel indica cuáles y dónde, y no carga nada.

### `challenges.yaml`: juego de pruebas

Se carga desde el panel con **Cargar pruebas**.

```yaml
title: Juego de pruebas
intro: >
  Explicación del juego. Admite **negrita**.

challenges:                     # tantas pruebas como quieras, en este orden
  - id: 1                       # número o texto corto (sin "/"); se muestra en el botón
    description: |
      Cantar un villancico completo.
  - id: bonus
    description: Construir un muñeco de nieve.
```

El estado de cada prueba se conserva al recargar el YAML. Solo se borra el de las pruebas que se quitan del fichero.

## Personalización

- **Tema visual:** se elige al arrancar el frontend con la variable `THEME`. Por defecto es `negro-naranja`; también está `blanco-azul`.

  ```bash
  THEME=blanco-azul docker compose up -d frontend
  ```

  También se puede fijar en `docker/.env` (`THEME=blanco-azul`). La web no permite cambiarlo. Para crear un tema, copia un fichero de `frontend/src/styles/themes/` con otro nombre (solo minúsculas, números y guiones) y cambia sus colores y tipografías. Si el tema no existe, el frontend no arranca y los logs muestran los temas disponibles. Cada tema define las variables de color de shadcn/ui (`--background`, `--foreground`, `--primary`, `--card`, `--muted-foreground`, `--destructive`, `--success`…), las tipografías (`--font-title`, `--font-body`) y el brillo (`--glow`). El favicon se genera con los colores del tema (`--background` de fondo y `--primary` en las líneas) a partir de la plantilla `frontend/src/assets/favicon.svg`.
- **Tipos de día e imágenes:** se definen en la sección `types` de `days.yaml`, y las imágenes van en `frontend/public/images/`.
- **Componentes de shadcn/ui:** se añaden con su herramienta, desde un contenedor de Node (no hace falta Node en el ordenador):

  ```bash
  cd frontend
  docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/app -w /app node:22-alpine \
    npx shadcn@latest add <componente> --yes --overwrite
  ```

  Revisa después los ficheros de `src/components/ui/`: la herramienta a veces escribe `import { cn } from "cn"` e instala un paquete `cn` que no es el nuestro. Hay que cambiarlo por `@/lib/utils` y desinstalar el paquete (`npm uninstall cn`).
- **Esquema de la base de datos:** está en `backend/db/schema.sql` y se aplica en cada arranque del backend. Usa `CREATE TABLE IF NOT EXISTS`, así que solo crea lo que falta: para modificar tablas que ya existen, añade el `ALTER TABLE` correspondiente.
- **Número de días e intentos:** 24 días y 10 intentos. Estos valores están tanto en `schema.sql` como en `backend/app/db.py` (`TOTAL_DAYS` y `MAX_ATTEMPTS`), y deben coincidir.

## API

La documentación interactiva está en http://localhost:8000/api/docs (también en `http://localhost:5173/api/docs` a través del proxy del frontend).

Para probar los endpoints de administración:

1. Llama a `POST /api/admin/login` y copia el `token` de la respuesta.
2. Pulsa **Authorize → Administrador** y pégalo.

El frontend solo habla con la base de datos a través de estos endpoints.

## Seguridad

Es un juego, no una aplicación crítica:

- Las contraseñas de los días se guardan en texto plano, tanto en el YAML como en la base de datos.
- La contraseña de administrador se guarda cifrada (scrypt) en la base de datos, pero en `admin.yaml` está en texto plano.
- La configuración está pensada para uso local (servidor de desarrollo de Vite, recarga automática).

Antes de exponerlo en Internet, conviene:

- servir el frontend compilado (`npm run build`);
- usar HTTPS;
- cambiar las credenciales por defecto.
