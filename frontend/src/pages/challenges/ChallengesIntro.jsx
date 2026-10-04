import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import RichText from '../../components/RichText.jsx'
import { fetchJson } from './status.js'

// Página principal del juego de pruebas: explicación y botón para continuar
export default function ChallengesIntro() {
  const [game, setGame] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchJson('/api/challenges')
      .then(setGame)
      .catch(() => setError('No se ha podido cargar el juego de pruebas.'))
  }, [])

  return (
    <main className="page">
      {error && <p>{error}</p>}
      {!game && !error && <p>Cargando...</p>}
      {game && (
        <>
          <h1>{game.title}</h1>
          <p className="intro">
            <RichText text={game.intro} />
          </p>
          <Link to="/pruebas/lista" className="button">
            Continuar
          </Link>
        </>
      )}
    </main>
  )
}
