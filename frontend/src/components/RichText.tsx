import type { ReactNode } from 'react'

// Formato sencillo en textos que vienen de los YAML:
//   **texto**              -> negrita
//   [texto](https://...)   -> enlace (se abre en otra pestaña)
const TOKEN = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g

export function RichText({ text }: { text: string }) {
  const source = text.trim()
  const parts: ReactNode[] = []
  let last = 0

  for (const match of source.matchAll(TOKEN)) {
    if (match.index > last) parts.push(source.slice(last, match.index))
    const [, bold, label, url] = match
    parts.push(
      bold !== undefined ? (
        <strong key={match.index} className="font-semibold text-foreground">
          {bold}
        </strong>
      ) : (
        <a
          key={match.index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary"
        >
          {label}
        </a>
      ),
    )
    last = match.index + match[0].length
  }
  if (last < source.length) parts.push(source.slice(last))
  return <>{parts}</>
}
