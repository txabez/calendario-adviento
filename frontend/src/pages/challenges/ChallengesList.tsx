import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Page, PageTitle } from '@/components/Page'
import { fetchChallenges, type ChallengeGame } from '@/lib/api'
import { cn } from '@/lib/utils'
import { statusInfo } from './status'

// Un botón por prueba, con su estado
export default function ChallengesList() {
  const [game, setGame] = useState<ChallengeGame | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchChallenges()
      .then(setGame)
      .catch((e: Error) => setError(e.message))
  }, [])

  const done = game?.challenges.filter((c) => c.status).length ?? 0
  const total = game?.challenges.length ?? 0

  return (
    <Page>
      <Button asChild variant="ghost" className="self-start text-muted-foreground">
        <Link to="/pruebas">
          <ChevronLeft /> Inicio
        </Link>
      </Button>
      <PageTitle title={game?.title ?? 'Pruebas'} />

      {error && <p className="mt-8">{error}</p>}
      {!game && !error && <Loader2 className="mt-8 size-8 animate-spin text-muted-foreground" />}

      {game && (
        <>
          <div className="mt-8 w-full max-w-xs">
            <div className="mb-2 flex justify-between text-xs text-muted-foreground">
              <span>Pruebas jugadas</span>
              <span>
                {done} / {total}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-primary shadow-glow"
                initial={{ width: 0 }}
                animate={{ width: `${total ? (done / total) * 100 : 0}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>

          <div className="mt-10 grid w-full grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-3 sm:gap-4">
            {game.challenges.map((c, i) => {
              const status = statusInfo(c.status)
              const Icon = status?.icon
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 16, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: i * 0.04, type: 'spring', stiffness: 260, damping: 20 }}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.94 }}
                >
                  <Link
                    to={`/pruebas/prueba/${encodeURIComponent(c.id)}`}
                    className={cn(
                      'flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl border bg-card p-3 text-center transition-colors hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                      status ? status.border : 'border-border',
                    )}
                  >
                    <span className="font-display text-2xl break-all">{c.id}</span>
                    <span className={cn('flex items-center gap-1 text-xs', status ? status.text : 'text-muted-foreground')}>
                      {Icon && <Icon className="size-3.5" />}
                      {status ? status.label : 'Pendiente'}
                    </span>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </>
      )}
    </Page>
  )
}
