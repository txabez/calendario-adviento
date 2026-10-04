import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

// Contenedor común de las páginas: centrado, con el halo de color del tema arriba
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main
      className={cn(
        'relative mx-auto flex min-h-svh w-full max-w-3xl flex-col items-center px-4 py-10 sm:py-16',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(ellipse_at_top,var(--primary)_0%,transparent_70%)] opacity-15"
      />
      {children}
    </main>
  )
}

// Título principal con subtítulo opcional, con la entrada animada
export function PageTitle({ title, subtitle }: { title: string; subtitle?: string | null }) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="text-center"
    >
      <h1 className="font-display text-3xl font-light tracking-[0.15em] uppercase drop-shadow-[var(--glow)] sm:text-5xl">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2 font-display text-sm tracking-[0.3em] text-muted-foreground uppercase sm:text-base">
          {subtitle}
        </p>
      )}
    </motion.header>
  )
}

// Aparición suave del contenido de una página
export function FadeIn({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
