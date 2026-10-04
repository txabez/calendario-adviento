import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchJson, statusInfo } from './status.js'

// Un botón por prueba, con su estado
export default function ChallengesList() {
  const [game, setGame] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchJson('/api/challenges')
      .then(setGame)
      .catch(() => setError('No se han podido cargar las pruebas.'))
  }, [])

  return (
    <main className="page">
      <h1>{game?.title ?? 'Pruebas'}</h1>
      {error && <p>{error}</p>}
      {!game && !error && <p>Cargando...</p>}

      {game && (
        <div className="challenge-grid">
          {game.challenges.map((c) => {
            const status = statusInfo(c.status)
            return (
              <Link
                key={c.id}
                to={`/pruebas/prueba/${encodeURIComponent(c.id)}`}
                className={`challenge-tile ${status ? `status-${status.value}` : ''}`}
              >
                <span className="challenge-tile-id">{c.id}</span>
                <small>{status ? `${status.icon} ${status.label}` : 'Pendiente'}</small>
              </Link>
            )
          })}
        </div>
      )}

      <Link to="/pruebas" className="button">
        Volver
      </Link>
    </main>
  )
}
