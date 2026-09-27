import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

// Convierte **texto** en negrita
function RichText({ text }) {
  return text
    .trim()
    .split(/\*\*(.+?)\*\*/g)
    .map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))
}

export default function Welcome() {
  const [page, setPage] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/welcome')
      .then((r) => {
        if (!r.ok) throw new Error('No se ha podido cargar la bienvenida.')
        return r.json()
      })
      .then(setPage)
      .catch((e) => setError(e.message))
  }, [])

  if (error) {
    return (
      <main className="page">
        <p>{error}</p>
      </main>
    )
  }

  if (!page) {
    return (
      <main className="page">
        <p>Cargando...</p>
      </main>
    )
  }

  return (
    <main className="page">
      <h1>
        {page.title}
        {page.subtitle && <span className="subtitle">{page.subtitle}</span>}
      </h1>

      {page.intro && (
        <p className="intro">
          <RichText text={page.intro} />
        </p>
      )}

      {page.sections?.map((section, i) => (
        <section key={i} className="text-block">
          <h2>{section.heading}</h2>
          {section.content?.map((block, j) =>
            block.list ? (
              <ul key={j}>
                {block.list.map((item, k) => (
                  <li key={k}>
                    <RichText text={item} />
                  </li>
                ))}
              </ul>
            ) : (
              <p key={j}>
                <RichText text={block.text} />
              </p>
            ),
          )}
        </section>
      ))}

      <Link to="/calendario" className="button">
        Continuar
      </Link>
    </main>
  )
}
