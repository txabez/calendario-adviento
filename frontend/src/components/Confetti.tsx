import { motion } from 'motion/react'

const COLORS = ['var(--primary)', 'var(--success)', 'var(--foreground)', 'var(--muted-foreground)']

// Pequeña explosión de confeti con los colores del tema. Cambia `burst` para lanzarla.
export function Confetti({ burst }: { burst: number }) {
  if (!burst) return null
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      {Array.from({ length: 28 }, (_, i) => {
        const angle = (i / 28) * Math.PI * 2
        const distance = 90 + ((i * 37) % 70)
        return (
          <motion.span
            key={`${burst}-${i}`}
            className="absolute top-1/2 left-1/2 size-2 rounded-[2px]"
            style={{ backgroundColor: COLORS[i % COLORS.length] }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
            animate={{
              x: Math.cos(angle) * distance,
              y: Math.sin(angle) * distance + 40,
              opacity: 0,
              rotate: (i % 2 ? 1 : -1) * 270,
              scale: 0.6,
            }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
          />
        )
      })}
    </div>
  )
}
