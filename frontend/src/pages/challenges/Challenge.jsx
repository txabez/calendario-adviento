import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { STATUSES, fetchJson, statusInfo } from './status.js'

// Presentación de una prueba con los botones para marcar su estado
export default function Challenge() {
  const { id } = useParams()
  const [challenge, setChallenge] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const url = `/api/challenges/${encodeURIComponent(id)}`

  useEffect(() => {
    setChallenge(null)
    setError(null)
    fetchJson(url)
      .then(setChallenge)
      .catch((e) => setError(e.message === 'No se ha encontrado.' ? 'Esta prueba no existe.' : e.message))
  }, [url])

  function mark(status) {
    setSaving(true)
    fetchJson(`${url}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
      .then(() => setChallenge((c) => ({ ...c, status })))
      .catch((e) => setError(e.message))
      .finally(() => setSaving(false))
  }

  const current = statusInfo(challenge?.status)

  return (
    <main className="page">
      <h1>Prueba {id}</h1>
      {error && <p className="error">{error}</p>}
      {!challenge && !error && <p>Cargando...</p>}

      {challenge && (
        <>
          <p className="message">{challenge.description}</p>

          <p className={`challenge-status ${current ? `status-${current.value}` : ''}`}>
            {current ? `${current.icon} ${current.label}` : 'Pendiente'}
          </p>

          <div className="challenge-actions">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                className={`button button-small status-${s.value} ${challenge.status === s.value ? 'active' : ''}`}
                onClick={() => mark(s.value)}
                disabled={saving}
                aria-pressed={challenge.status === s.value}
              >
                {s.button}
              </button>
            ))}
          </div>
        </>
      )}

      <Link to="/pruebas/lista" className="button">
        Volver a las pruebas
      </Link>
    </main>
  )
}
