import { Check, Minus, X, type LucideIcon } from 'lucide-react'
import type { ChallengeStatus } from '@/lib/api'

// Estados de una prueba: valor del backend -> textos, icono y colores del tema
export const STATUSES: {
  value: ChallengeStatus
  button: string
  label: string
  icon: LucideIcon
  text: string
  border: string
  fill: string
  // Si se pide confirmación antes de marcarlo: pregunta del diálogo
  confirm?: string
}[] = [
  {
    value: 'success',
    button: 'Superada',
    label: 'Superada',
    icon: Check,
    text: 'text-success',
    border: 'border-success',
    fill: 'bg-success text-background hover:bg-success/90',
  },
  {
    value: 'fail',
    button: 'Fallida',
    label: 'Fallida',
    icon: X,
    text: 'text-destructive',
    border: 'border-destructive',
    fill: 'bg-destructive text-background hover:bg-destructive/90',
    confirm: '¿Seguro que la prueba ha fallado?',
  },
  {
    value: 'ignore',
    button: 'Ignorar',
    label: 'Ignorada',
    icon: Minus,
    text: 'text-muted-foreground',
    border: 'border-muted-foreground/50',
    fill: 'bg-muted-foreground text-background hover:bg-muted-foreground/90',
    confirm: '¿Seguro que quieres ignorar esta prueba?',
  },
]

export function statusInfo(value: ChallengeStatus | null | undefined) {
  return STATUSES.find((s) => s.value === value)
}
