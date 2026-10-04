import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { Lock, LockOpen } from 'lucide-react'
import { Page, PageTitle } from '@/components/Page'
import { fetchDays, type DayStatus } from '@/lib/api'
import { cn } from '@/lib/utils'

const TOTAL_DAYS = 24
const DAYS = Array.from({ length: TOTAL_DAYS }, (_, i) => i + 1)

type State = 'unlocked' | 'locked' | 'blocked'

const LABELS: Record<State, string> = {
  unlocked: 'abierto',
  locked: 'cerrado',
  blocked: 'bloqueado',
}

export default function Calendar() {
  const [status, setStatus] = useState<Record<number, DayStatus>>({})

  useEffect(() => {
    fetchDays()
      .then((days) => setStatus(Object.fromEntries(days.map((d) => [d.id, d]))))
      .catch(() => {}) // sin estado: todos los días se muestran cerrados
  }, [])

  const opened = Object.values(status).filter((d) => d.unlocked).length

  return (
    <Page>
      <PageTitle title="Calendario Adviento" subtitle="20 aniversario" />

      {/* Progreso */}
      <div className="mt-8 w-full max-w-xs">
        <div className="mb-2 flex justify-between text-xs text-muted-foreground">
          <span>Días abiertos</span>
          <span>
            {opened} / {TOTAL_DAYS}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-primary shadow-glow"
            initial={{ width: 0 }}
            animate={{ width: `${(opened / TOTAL_DAYS) * 100}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>

      <div className="mt-10 grid w-full grid-cols-4 gap-3 sm:grid-cols-6 sm:gap-4">
        {DAYS.map((day, i) => {
          const { unlocked = false, blocked = false } = status[day] ?? {}
          const state: State = unlocked ? 'unlocked' : blocked ? 'blocked' : 'locked'
          const Icon = unlocked ? LockOpen : Lock
          return (
            <motion.div
              key={day}
              initial={{ opacity: 0, y: 16, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: i * 0.025, type: 'spring', stiffness: 260, damping: 20 }}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.94 }}
            >
              <Link
                to={`/dia/${day}`}
                aria-label={`Día ${day}, ${LABELS[state]}`}
                className={cn(
                  'relative flex aspect-square flex-col items-center justify-center rounded-xl border font-display transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                  state === 'locked' && 'border-border bg-card text-card-foreground hover:border-primary',
                  state === 'unlocked' && 'border-primary bg-primary text-primary-foreground shadow-glow',
                  state === 'blocked' && 'border-destructive/60 bg-card text-destructive opacity-60',
                )}
              >
                <span className="text-2xl sm:text-3xl">{day}</span>
                <Icon
                  className={cn(
                    'absolute top-2 right-2 size-3.5 sm:size-4',
                    state === 'locked' && 'text-muted-foreground',
                  )}
                />
              </Link>
            </motion.div>
          )
        })}
      </div>
    </Page>
  )
}
