"""
Validación y carga en base de datos de los YAML de contenido.

Se usan desde el panel de administración (días, bienvenida y pruebas): si el
YAML tiene errores se lanza YamlError con la lista de problemas y no se carga nada.
"""
import yaml
from psycopg.types.json import Jsonb

from app.db import TOTAL_DAYS, connect


class YamlError(Exception):
    def __init__(self, errors):
        super().__init__("; ".join(errors))
        self.errors = errors


def parse_yaml(text):
    try:
        return yaml.safe_load(text)
    except yaml.YAMLError as e:
        mark = getattr(e, "problem_mark", None)
        where = f" (línea {mark.line + 1})" if mark else ""
        raise YamlError([f"el fichero no es un YAML válido{where}"]) from e


def is_text(value):
    return isinstance(value, str) and value.strip()


# --- Días ---------------------------------------------------------------------


def validate_types(data):
    types = data.get("types")
    if not isinstance(types, list) or not types:
        return [], ["falta la lista 'types' con los tipos de día"]

    errors = []
    keys = []
    for i, day_type in enumerate(types, start=1):
        where = f"tipo {i}"
        if not isinstance(day_type, dict):
            errors.append(f"{where}: no es un tipo válido")
            continue
        key = day_type.get("key")
        if not is_text(key):
            errors.append(f"{where}: falta 'key'")
        elif key in keys:
            errors.append(f"{where}: el tipo '{key}' está repetido")
        else:
            keys.append(key)
            where = f"tipo '{key}'"
        if not is_text(day_type.get("label")):
            errors.append(f"{where}: falta 'label'")
        image = day_type.get("image")
        if image is not None and (not is_text(image) or "/" in image or "\\" in image):
            errors.append(f"{where}: 'image' debe ser solo el nombre del fichero, p. ej. regalo.webp")
    return keys, errors


def validate_days(data):
    if not isinstance(data, dict) or not isinstance(data.get("days"), list):
        return ["no es un fichero de días: falta la lista 'days'"]
    days = data["days"]
    if not days:
        return ["la lista 'days' está vacía"]

    type_keys, errors = validate_types(data)
    seen = set()
    for i, day in enumerate(days, start=1):
        where = f"entrada {i}"
        if not isinstance(day, dict):
            errors.append(f"{where}: no es un día válido")
            continue
        day_id = day.get("id")
        if not isinstance(day_id, int) or not 1 <= day_id <= TOTAL_DAYS:
            errors.append(f"{where}: 'id' debe ser un número del 1 al {TOTAL_DAYS}")
        elif day_id in seen:
            errors.append(f"{where}: el día {day_id} está repetido")
        else:
            seen.add(day_id)
            where = f"día {day_id}"
        if type_keys and day.get("type") not in type_keys:
            errors.append(f"{where}: 'type' debe ser uno de los de 'types': {', '.join(type_keys)}")
        if day.get("password") is not None and not isinstance(day["password"], str):
            errors.append(f"{where}: pon 'password' entre comillas, p. ej. password: \"1234\"")
        for field in ("password", "message"):
            if not str(day.get(field) or "").strip():
                errors.append(f"{where}: falta '{field}'")
    return errors


def load_days(text):
    """Deja las tablas day_types y days igual que el YAML. Los intentos restantes no se tocan."""
    data = parse_yaml(text)
    errors = validate_days(data)
    if errors:
        raise YamlError(errors)
    days = data["days"]
    types = data["types"]

    with connect() as conn:
        for day_type in types:
            conn.execute(
                """
                INSERT INTO day_types (key, label, image) VALUES (%(key)s, %(label)s, %(image)s)
                ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, image = EXCLUDED.image
                """,
                {
                    "key": day_type["key"].strip(),
                    "label": day_type["label"].strip(),
                    "image": (day_type.get("image") or "").strip() or None,
                },
            )
        conn.execute(
            "DELETE FROM day_types WHERE NOT (key = ANY(%s))", ([t["key"].strip() for t in types],)
        )
        for day in days:
            conn.execute(
                """
                INSERT INTO days (id, password, type, message)
                VALUES (%(id)s, %(password)s, %(type)s, %(message)s)
                ON CONFLICT (id) DO UPDATE
                SET password = EXCLUDED.password, type = EXCLUDED.type,
                    message = EXCLUDED.message
                """,
                {
                    "id": day["id"],
                    "password": day["password"].strip(),
                    "type": day["type"],
                    "message": str(day["message"]).strip(),
                },
            )
        deleted = conn.execute(
            "DELETE FROM days WHERE NOT (id = ANY(%s))", ([d["id"] for d in days],)
        ).rowcount

    return {"loaded": len(days), "deleted": deleted, "types": len(types)}


# --- Bienvenida ---------------------------------------------------------------


def validate_welcome(data):
    if not isinstance(data, dict):
        return ["el fichero está vacío o no tiene el formato esperado"]
    errors = []
    if not is_text(data.get("title")):
        errors.append("falta 'title'")
    for field in ("subtitle", "intro"):
        if data.get(field) is not None and not is_text(data[field]):
            errors.append(f"'{field}' debe ser un texto")

    sections = data.get("sections") or []
    if not isinstance(sections, list):
        return errors + ["'sections' debe ser una lista"]
    for i, section in enumerate(sections, start=1):
        where = f"sección {i}"
        if not isinstance(section, dict):
            errors.append(f"{where}: formato no válido")
            continue
        if not is_text(section.get("heading")):
            errors.append(f"{where}: falta 'heading'")
        else:
            where = f"sección '{section['heading']}'"
        content = section.get("content") or []
        if not isinstance(content, list):
            errors.append(f"{where}: 'content' debe ser una lista")
            continue
        for j, block in enumerate(content, start=1):
            if not isinstance(block, dict) or len(block) != 1:
                errors.append(f"{where}, elemento {j}: debe ser '- text: ...' o '- list: ...'")
            elif "text" in block:
                if not is_text(block["text"]):
                    errors.append(f"{where}, elemento {j}: 'text' vacío")
            elif "list" in block:
                items = block["list"]
                if not isinstance(items, list) or not items or not all(is_text(x) for x in items):
                    errors.append(f"{where}, elemento {j}: 'list' debe ser una lista de textos")
            else:
                errors.append(f"{where}, elemento {j}: debe ser '- text: ...' o '- list: ...'")
    return errors


def load_welcome(text):
    """Deja la tabla welcome igual que el YAML: title, subtitle, intro y section_1, section_2..."""
    data = parse_yaml(text)
    errors = validate_welcome(data)
    if errors:
        raise YamlError(errors)

    rows = {key: data[key] for key in ("title", "subtitle", "intro") if data.get(key)}
    for i, section in enumerate(data.get("sections") or [], start=1):
        rows[f"section_{i}"] = {"heading": section["heading"], "content": section.get("content") or []}

    with connect() as conn:
        conn.execute("DELETE FROM welcome")
        for key, value in rows.items():
            conn.execute("INSERT INTO welcome (key, value) VALUES (%s, %s)", (key, Jsonb(value)))

    return {"sections": len(data.get("sections") or [])}


# --- Juego de pruebas -----------------------------------------------------------


def validate_challenges(data):
    if not isinstance(data, dict):
        return ["el fichero está vacío o no tiene el formato esperado"]
    errors = []
    for field in ("title", "intro"):
        if not is_text(data.get(field)):
            errors.append(f"falta '{field}'")

    challenges = data.get("challenges")
    if not isinstance(challenges, list) or not challenges:
        return errors + ["falta la lista 'challenges' con las pruebas"]
    seen = set()
    for i, challenge in enumerate(challenges, start=1):
        where = f"prueba {i}"
        if not isinstance(challenge, dict):
            errors.append(f"{where}: formato no válido")
            continue
        challenge_id = challenge.get("id")
        if isinstance(challenge_id, bool) or not isinstance(challenge_id, (int, str)) or not str(challenge_id).strip():
            errors.append(f"{where}: falta 'id' (un número o un texto)")
        elif "/" in str(challenge_id):
            errors.append(f"{where}: 'id' no puede contener '/'")
        elif str(challenge_id).strip() in seen:
            errors.append(f"{where}: el id '{challenge_id}' está repetido")
        else:
            seen.add(str(challenge_id).strip())
            where = f"prueba '{challenge_id}'"
        if not is_text(challenge.get("description")):
            errors.append(f"{where}: falta 'description'")
    return errors


def load_challenges(text):
    """Deja las pruebas igual que el YAML. Los estados de las pruebas que siguen se conservan."""
    data = parse_yaml(text)
    errors = validate_challenges(data)
    if errors:
        raise YamlError(errors)
    challenges = data["challenges"]
    ids = [str(c["id"]).strip() for c in challenges]

    with connect() as conn:
        conn.execute("DELETE FROM challenges_page")
        for key in ("title", "intro"):
            conn.execute(
                "INSERT INTO challenges_page (key, value) VALUES (%s, %s)", (key, data[key].strip())
            )
        for position, (challenge_id, challenge) in enumerate(zip(ids, challenges), start=1):
            conn.execute(
                """
                INSERT INTO challenges (id, description, position) VALUES (%s, %s, %s)
                ON CONFLICT (id) DO UPDATE
                SET description = EXCLUDED.description, position = EXCLUDED.position
                """,
                (challenge_id, challenge["description"].strip(), position),
            )
        deleted = conn.execute("DELETE FROM challenges WHERE NOT (id = ANY(%s))", (ids,)).rowcount

    return {"loaded": len(ids), "deleted": deleted}
