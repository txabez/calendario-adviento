import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Confetti } from '@/components/Confetti'
import {
  NoSessionError,
  fetchChallenge,
  setChallengeStatus,
  type Challenge as ChallengeData,
  type ChallengeStatus,
} from '@/lib/api'
import { useConsent } from '@/lib/consent'
import { cn } from '@/lib/utils'
import { STATUSES, statusInfo } from './status'

// Presentación de una prueba con los botones para marcar su estado
export default function Challenge() {
  const { id = '' } = useParams()
  const [challenge, setChallenge] = useState<ChallengeData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [burst, setBurst] = useState(0)
  const { requireConsent } = useConsent()

  useEffect(() => {
    setChallenge(null)
    setError(null)
    fetchChallenge(id)
      .then(setChallenge)
      .catch((e: Error) => setError(e.message))
  }, [id])

  async function mark(status: ChallengeStatus) {
    setSaving(true)
    try {
      await setChallengeStatus(id, status)
      setChallenge((c) => (c ? { ...c, status } : c))
      if (status === 'success') setBurst((b) => b + 1)
    } catch (e) {
      if (e instanceof NoSessionError) requireConsent()
      else setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const current = statusInfo(challenge?.status)

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col px-4 py-6">
      <Button asChild variant="ghost" className="self-start text-muted-foreground">
        <Link to="/pruebas/lista">
          <ChevronLeft /> Pruebas
        </Link>
      </Button>

      <div className="flex flex-1 items-center">
        <motion.div
          className="relative w-full"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Confetti burst={burst} />
          <Card className="w-full py-0">
            <CardContent className="flex flex-col items-center gap-6 px-6 py-10 text-center">
              <h1 className="font-display text-3xl tracking-[0.15em] uppercase">Prueba {id}</h1>

              {error && <p className="text-destructive">{error}</p>}
              {!challenge && !error && <Loader2 className="size-8 animate-spin text-muted-foreground" />}

              {challenge && (
                <>
                  <p className="text-lg leading-relaxed whitespace-pre-line">{challenge.description}</p>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={challenge.status ?? 'pending'}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                    >
                      <Badge
                        variant="outline"
                        className={cn('gap-1.5 px-3 py-1 font-display text-sm tracking-[0.15em] uppercase', current ? cn(current.text, current.border) : 'text-muted-foreground')}
                      >
                        {current && <current.icon />}
                        {current ? current.label : 'Pendiente'}
                      </Badge>
                    </motion.div>
                  </AnimatePresence>

                  <div className="grid w-full grid-cols-3 gap-2">
                    {STATUSES.map((s) => {
                      const active = challenge.status === s.value
                      return (
                        <Button
                          key={s.value}
                          type="button"
                          variant="outline"
                          className={cn('h-12 flex-col gap-0.5 text-xs', active ? cn(s.fill, 'border-transparent shadow-glow') : cn(s.text, s.border))}
                          onClick={() => mark(s.value)}
                          disabled={saving}
                          aria-pressed={active}
                        >
                          <s.icon />
                          {s.button}
                        </Button>
                      )
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </main>
  )
}
