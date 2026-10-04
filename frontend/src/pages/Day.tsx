import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion, useAnimationControls } from 'motion/react'
import { ChevronLeft, Loader2, Lock, LockOpen } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PasswordInput } from '@/components/PasswordInput'
import { fetchDay, unlockDay, type DayContent } from '@/lib/api'
import { useConsent } from '@/lib/consent'

type Phase =
  | { name: 'loading' }
  | { name: 'error'; message: string }
  | { name: 'locked' }
  | { name: 'opening'; content: DayContent }
  | { name: 'open'; content: DayContent }
  | { name: 'blocked' }

export default function Day() {
  const { id = '' } = useParams()
  const [phase, setPhase] = useState<Phase>({ name: 'loading' })
  const [attempts, setAttempts] = useState({ left: 0, max: 0 })
  const [password, setPassword] = useState('')
  const [wrong, setWrong] = useState(false)
  const [sending, setSending] = useState(false)
  const shake = useAnimationControls()
  const { requireConsent } = useConsent()

  useEffect(() => {
    setPhase({ name: 'loading' })
    setPassword('')
    setWrong(false)
    fetchDay(id)
      .then((day) => {
        setAttempts({ left: day.attempts_left, max: day.max_attempts })
        if (day.unlocked && day.content) setPhase({ name: 'open', content: day.content })
        else setPhase(day.blocked ? { name: 'blocked' } : { name: 'locked' })
      })
      .catch((e: Error) => setPhase({ name: 'error', message: e.message }))
  }, [id])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSending(true)
    setWrong(false)
    try {
      const result = await unlockDay(id, password)
      if (result.kind === 'no-session') return requireConsent()
      if (result.kind === 'blocked') setPhase({ name: 'blocked' })
      if (result.kind === 'wrong') {
        setWrong(true)
        setAttempts((a) => ({ ...a, left: result.attemptsLeft }))
        shake.start({ x: [0, -12, 12, -8, 8, -4, 0], transition: { duration: 0.45 } })
      }
      if (result.kind === 'open') {
        // Primero se abre el candado y después aparece el contenido
        setPhase({ name: 'opening', content: result.content })
        setTimeout(() => setPhase({ name: 'open', content: result.content }), 900)
      }
    } catch (e) {
      setPhase({ name: 'error', message: (e as Error).message })
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col px-4 py-6">
      <Button asChild variant="ghost" className="self-start text-muted-foreground">
        <Link to="/calendario">
          <ChevronLeft /> Calendario
        </Link>
      </Button>

      <div className="flex flex-1 items-center">
        <motion.div animate={shake} className="w-full">
          <Card className="w-full overflow-hidden border-border py-0">
            <CardContent className="flex flex-col items-center gap-6 px-6 py-10 text-center">
              <AnimatePresence mode="wait">
                {phase.name === 'loading' && (
                  <Loader2 key="loading" className="size-8 animate-spin text-muted-foreground" />
                )}

                {phase.name === 'error' && (
                  <motion.p key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {phase.message}
                  </motion.p>
                )}

                {(phase.name === 'locked' || phase.name === 'opening' || phase.name === 'blocked') && (
                  <motion.div
                    key="locked"
                    className="flex w-full flex-col items-center gap-6"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <LockCircle state={phase.name} />
                    <h1 className="font-display text-3xl tracking-[0.15em] uppercase">Día {id}</h1>

                    {phase.name === 'blocked' ? (
                      <p className="text-destructive">Este día está bloqueado.</p>
                    ) : (
                      <form onSubmit={submit} className="flex w-full flex-col gap-4">
                        <label htmlFor="password" className="text-sm text-muted-foreground">
                          Introduce la contraseña para abrir este día
                        </label>
                        <PasswordInput
                          id="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          aria-invalid={wrong}
                          disabled={phase.name === 'opening'}
                          autoFocus
                          required
                        />
                        <AnimatePresence>
                          {attempts.left < attempts.max && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="flex flex-col items-center gap-2"
                            >
                              {wrong && <p className="text-sm text-destructive">Contraseña incorrecta</p>}
                              <Badge variant="outline" className="text-muted-foreground">
                                {attempts.left === 1 ? 'Te queda 1 intento' : `Te quedan ${attempts.left} intentos`}
                              </Badge>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <Button
                          type="submit"
                          size="lg"
                          className="h-12 font-display tracking-[0.2em] uppercase shadow-glow"
                          disabled={sending || phase.name === 'opening'}
                        >
                          {sending && <Loader2 className="animate-spin" />}
                          Abrir
                        </Button>
                      </form>
                    )}
                  </motion.div>
                )}

                {phase.name === 'open' && <DayReveal key="open" id={id} content={phase.content} />}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </main>
  )
}

// Candado grande: cerrado y "respirando", abriéndose al acertar, o bloqueado
function LockCircle({ state }: { state: 'locked' | 'opening' | 'blocked' }) {
  const opening = state === 'opening'
  const blocked = state === 'blocked'
  return (
    <motion.div
      className={
        blocked
          ? 'flex size-24 items-center justify-center rounded-full border border-destructive/50 bg-destructive/10 text-destructive'
          : 'flex size-24 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary shadow-glow'
      }
      animate={
        opening
          ? { scale: [1, 1.25, 1.1], rotate: [0, -12, 0] }
          : blocked
            ? {}
            : { scale: [1, 1.05, 1] }
      }
      transition={opening ? { duration: 0.6 } : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
    >
      {opening ? <LockOpen className="size-10" /> : <Lock className="size-10" />}
    </motion.div>
  )
}

// Contenido del día, apareciendo por partes
function DayReveal({ id, content }: { id: string; content: DayContent }) {
  const item = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0 },
  }
  return (
    <motion.div
      className="flex flex-col items-center gap-5"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.15 } } }}
    >
      <motion.div variants={item} className="flex items-center gap-3">
        {content.type.image && (
          <motion.img
            src={`/images/${content.type.image}`}
            alt=""
            className="size-20 drop-shadow-[var(--glow)] sm:size-24"
            initial={{ scale: 0.6, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 12 }}
          />
        )}
        <Badge className="px-3 py-1 font-display text-sm tracking-[0.15em] uppercase">
          {content.type.label}
        </Badge>
      </motion.div>
      <motion.h1 variants={item} className="font-display text-3xl tracking-[0.15em] uppercase">
        Día {id}
      </motion.h1>
      <motion.p variants={item} className="text-lg leading-relaxed whitespace-pre-line">
        {content.message}
      </motion.p>
    </motion.div>
  )
}
