import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Loader2, LogOut, User } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useConsent } from '@/lib/consent'

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
}

// Avatar del jugador, arriba a la derecha, con el menú para cerrar la sesión
export function UserMenu() {
  const { session, logout } = useConsent()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [closing, setClosing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onLogout() {
    setClosing(true)
    setError(null)
    try {
      await logout()
      setConfirming(false)
      navigate('/')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setClosing(false)
    }
  }

  return (
    <>
      <motion.div
        className="fixed top-3 right-3 z-40 sm:top-4 sm:right-4"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger
            className="rounded-full focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            aria-label="Menú del jugador"
          >
            <Avatar className="size-10 border border-primary/40 shadow-glow transition-transform hover:scale-105">
              <AvatarFallback className="bg-card text-primary">
                <User className="size-5" />
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span>Sesión de jugador</span>
              {session && (
                <span className="text-xs font-normal text-muted-foreground">
                  Desde {formatDate(session.created_at)}
                </span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
              <LogOut /> Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </motion.div>

      <AlertDialog open={confirming} onOpenChange={(open) => !closing && setConfirming(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar la sesión?</AlertDialogTitle>
            <AlertDialogDescription>
              Tendrás que volver a aceptar las condiciones, y los días que ya habías abierto
              volverán a pedir la contraseña.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closing}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={onLogout} disabled={closing}>
              {closing && <Loader2 className="animate-spin" />}
              Cerrar sesión
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
