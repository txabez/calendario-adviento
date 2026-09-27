import { useCallback, useEffect, useRef, useState } from 'react'
import PasswordInput from '../components/PasswordInput.jsx'

const TOKEN_KEY = 'adminToken'

function formatDate(value) {
  return new Date(value).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
}

function loadToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function saveToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // Sin almacenamiento: la sesión solo dura mientras la página esté abierta
  }
}

export default function Admin() {
  const [token, setToken] = useState(loadToken)

  function changeToken(value) {
    saveToken(value)
    setToken(value)
  }

  return token ? (
    <Panel token={token} onLogout={() => changeToken(null)} />
  ) : (
    <Login onLogin={changeToken} />
  )
}

function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [sending, setSending] = useState(false)

  function submit(event) {
    event.preventDefault()
    setSending(true)
    setError(null)
    fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
      .then((r) => {
        if (r.status === 401) throw new Error('Usuario o contraseña incorrectos')
        if (!r.ok) throw new Error('No se ha podido iniciar sesión')
        return r.json()
      })
      .then((data) => onLogin(data.token))
      .catch((e) => setError(e.message))
      .finally(() => setSending(false))
  }

  return (
    <main className="page">
      <h1>Administración</h1>
      <form className="password-form" onSubmit={submit}>
        <label htmlFor="username">Usuario</label>
        <input
          id="username"
          className="input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
          required
        />
        <label htmlFor="password">Contraseña</label>
        <PasswordInput
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" className="button" disabled={sending}>
          Entrar
        </button>
      </form>
    </main>
  )
}

function Panel({ token, onLogout }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [busyDay, setBusyDay] = useState(null)
  const [upload, setUpload] = useState(null) // { ok, text, errors }
  const [players, setPlayers] = useState(null)
  const [closing, setClosing] = useState(null)

  const api = useCallback(
    (path, { json, ...options } = {}) =>
      fetch(`/api/admin${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(json && { 'Content-Type': 'application/json' }),
        },
        body: json && JSON.stringify(json),
      }).then(async (r) => {
        if (r.status === 401) {
          onLogout()
          throw new Error('La sesión ha caducado')
        }
        if (r.status === 400) {
          const data = await r.json()
          const error = new Error('El YAML tiene errores, no se ha cargado nada:')
          error.details = data.detail?.errors ?? []
          throw error
        }
        if (!r.ok) throw new Error('Error al hablar con el servidor')
        return r.json()
      }),
    [token, onLogout],
  )

  const loadDays = useCallback(() => {
    api('/days')
      .then(setData)
      .catch((e) => setError(e.message))
  }, [api])

  useEffect(loadDays, [loadDays])

  const loadPlayers = useCallback(() => {
    api('/players')
      .then((data) => setPlayers(data.players))
      .catch((e) => setError(e.message))
  }, [api])

  useEffect(loadPlayers, [loadPlayers])

  function closePlayer(id) {
    if (!window.confirm(`¿Cancelar la sesión #${id}? Sus días volverán a pedir la contraseña.`)) return
    setClosing(id)
    api(`/players/${id}`, { method: 'DELETE' })
      .then(loadPlayers)
      .catch((e) => setError(e.message))
      .finally(() => setClosing(null))
  }

  // action: 'reset' (devuelve todos los intentos) o 'block' (bloquea el día)
  function dayAction(id, action) {
    setBusyDay(id)
    api(`/days/${id}/${action}`, { method: 'POST' })
      .then(loadDays)
      .catch((e) => setError(e.message))
      .finally(() => setBusyDay(null))
  }

  function uploadYaml(path, file, describe) {
    setUpload(null)
    file
      .text()
      .then((content) => api(path, { method: 'POST', json: { content } }))
      .then((result) => {
        setUpload({ ok: true, text: `${file.name}: ${describe(result)}` })
        loadDays()
      })
      .catch((e) => setUpload({ ok: false, text: `${file.name}: ${e.message}`, errors: e.details }))
  }

  function logout() {
    api('/logout', { method: 'POST' }).catch(() => {})
    onLogout()
  }

  return (
    <main className="page">
      <h1>Administración</h1>
      {error && <p className="error">{error}</p>}
      {!data && !error && <p>Cargando...</p>}

      <div className="admin-actions">
        <YamlButton
          label="Cargar días"
          onFile={(file) =>
            uploadYaml('/days/upload', file, (r) =>
              `cargados ${r.loaded} días y ${r.types} tipos` +
              (r.deleted ? `, borrados ${r.deleted} días` : ''),
            )
          }
        />
        <YamlButton
          label="Cargar bienvenida"
          onFile={(file) =>
            uploadYaml('/welcome/upload', file, (r) =>
              `bienvenida cargada (${r.sections} secciones)`,
            )
          }
        />
      </div>

      {upload && (
        <div className={upload.ok ? 'admin-result' : 'admin-result error'}>
          <p>{upload.text}</p>
          {upload.errors?.length > 0 && (
            <ul>
              {upload.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {data && (
        <ul className="admin-list">
          {data.days.map((day) => {
            const blocked = day.attempts_left <= 0
            const full = day.attempts_left >= data.max_attempts
            return (
              <li key={day.id} className={blocked ? 'admin-day blocked' : 'admin-day'}>
                <span className="admin-day-number">{day.id}</span>
                <span className="admin-day-info">
                  <strong>{day.type_label}</strong>
                  <small>
                    {blocked
                      ? 'Bloqueado'
                      : `Intentos: ${day.attempts_left}/${data.max_attempts}`}
                  </small>
                </span>
                <span className="admin-day-actions">
                  <button
                    type="button"
                    className="button button-small"
                    onClick={() => dayAction(day.id, 'reset')}
                    disabled={full || busyDay === day.id}
                  >
                    Resetear
                  </button>
                  <button
                    type="button"
                    className="button button-small"
                    onClick={() => dayAction(day.id, 'block')}
                    disabled={blocked || busyDay === day.id}
                  >
                    Bloquear
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <section className="text-block">
        <h2>Sesiones de jugador</h2>
        {players?.length === 0 && <p>Todavía no se ha abierto ningún día.</p>}
        {players?.length > 0 && (
          <ul className="admin-list">
            {players.map((p) => (
              <li key={p.id} className="admin-day">
                <span className="admin-day-number">#{p.id}</span>
                <span className="admin-day-info">
                  <strong>
                    {p.unlocked_days.length
                      ? `Días abiertos: ${p.unlocked_days.join(', ')}`
                      : 'Sin días abiertos'}
                  </strong>
                  <small>Inicio: {formatDate(p.created_at)}</small>
                  <small>Última actividad: {formatDate(p.last_seen_at)}</small>
                </span>
                <button
                  type="button"
                  className="button button-small"
                  onClick={() => closePlayer(p.id)}
                  disabled={closing === p.id}
                >
                  Cancelar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button type="button" className="button" onClick={logout}>
        Cerrar sesión
      </button>
    </main>
  )
}

// Botón que abre el selector de ficheros y entrega el YAML elegido
function YamlButton({ label, onFile }) {
  const input = useRef(null)

  return (
    <>
      <button type="button" className="button button-small" onClick={() => input.current.click()}>
        {label}
      </button>
      <input
        ref={input}
        type="file"
        accept=".yaml,.yml"
        hidden
        onChange={(e) => {
          const file = e.target.files[0]
          e.target.value = '' // permite volver a elegir el mismo fichero
          if (file) onFile(file)
        }}
      />
    </>
  )
}
