import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPlayerToken, setPlayerToken } from '../player.js'
import PasswordInput from '../components/PasswordInput.jsx'

export default function Day() {
  const { id } = useParams()
  const [status, setStatus] = useState('loading') // loading | locked | blocked | open | error
  const [day, setDay] = useState(null)
  const [error, setError] = useState(null)
  const [password, setPassword] = useState('')
  const [wrongPassword, setWrongPassword] = useState(false)
  const [attempts, setAttempts] = useState({ left: null, max: null })
  const [sending, setSending] = useState(false)

  useEffect(() => {
    setStatus('loading')
    setDay(null)
    setPassword('')
    setWrongPassword(false)
    fetch(`/api/days/${id}`, { headers: { 'X-Player-Token': getPlayerToken() } })
      .then((r) => {
        if (r.status === 404) throw new Error('Este día todavía no tiene contenido.')
        if (!r.ok) throw new Error('No se ha podido cargar el día.')
        return r.json()
      })
      .then((data) => {
        setAttempts({ left: data.attempts_left, max: data.max_attempts })
        if (data.unlocked) {
          setDay(data.content)
          setStatus('open')
        } else {
          setStatus(data.blocked ? 'blocked' : 'locked')
        }
      })
      .catch((e) => {
        setError(e.message)
        setStatus('error')
      })
  }, [id])

  function unlock(event) {
    event.preventDefault()
    setSending(true)
    setWrongPassword(false)
    fetch(`/api/days/${id}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Player-Token': getPlayerToken() },
      body: JSON.stringify({ password }),
    })
      .then((r) => {
        if (r.status === 423) {
          setStatus('blocked')
          return
        }
        if (r.status === 401) {
          return r.json().then((data) => {
            setWrongPassword(true)
            setAttempts((a) => ({ ...a, left: data.detail.attempts_left }))
          })
        }
        if (!r.ok) throw new Error('No se ha podido abrir el día.')
        return r.json().then(({ player_token, ...data }) => {
          setPlayerToken(player_token)
          setDay(data)
          setStatus('open')
        })
      })
      .catch((e) => {
        setError(e.message)
        setStatus('error')
      })
      .finally(() => setSending(false))
  }

  return (
    <main className="page">
      {status === 'open' && (
        <div className="day-type">
          {day.type.image && (
            <img src={`/images/${day.type.image}`} alt="" className="day-type-image" />
          )}
          <span>{day.type.label}</span>
        </div>
      )}

      <h1>Día {id}</h1>

      {status === 'loading' && <p>Cargando...</p>}
      {status === 'error' && <p>{error}</p>}

      {status === 'locked' && (
        <form className="password-form" onSubmit={unlock}>
          <label htmlFor="password">Introduce la contraseña para abrir este día</label>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            required
          />
          {wrongPassword && <p className="error">Contraseña incorrecta</p>}
          {attempts.left < attempts.max && (
            <p className="attempts">
              {attempts.left === 1
                ? 'Te queda 1 intento'
                : `Te quedan ${attempts.left} intentos`}
            </p>
          )}
          <button type="submit" className="button" disabled={sending}>
            Abrir
          </button>
        </form>
      )}

      {status === 'blocked' && (
        <p className="error">Este día está bloqueado.</p>
      )}

      {status === 'open' && <p className="message">{day.message}</p>}

      <Link to="/calendario" className="button">
        Volver al calendario
      </Link>
    </main>
  )
}
