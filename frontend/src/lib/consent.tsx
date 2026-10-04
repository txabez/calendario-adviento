import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  acceptConditions,
  checkPlayerSession,
  closePlayerSession,
  fetchConsent,
  setPlayerToken,
  type ConsentTexts,
  type PlayerSessionInfo,
} from '@/lib/api'

// Estado de la aceptación de las condiciones en este navegador:
//   checking -> comprobando el token guardado
//   pending  -> no hay sesión válida: hay que mostrar las condiciones
//   accepted -> hay sesión de jugador
type ConsentState = 'checking' | 'pending' | 'accepted'

interface ConsentContextValue {
  state: ConsentState
  // Textos de consent.yaml (null mientras se cargan)
  texts: ConsentTexts | null
  // Sesión de jugador abierta (null si no hay)
  session: PlayerSessionInfo | null
  accept: (accepted: number[]) => Promise<void>
  // Cierra la sesión (logout): hay que volver a aceptar las condiciones
  logout: () => Promise<void>
  // Vuelve a pedir las condiciones (p. ej. si el administrador canceló la sesión)
  requireConsent: () => void
}

const ConsentContext = createContext<ConsentContextValue | null>(null)

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConsentState>('checking')
  const [texts, setTexts] = useState<ConsentTexts | null>(null)
  const [session, setSession] = useState<PlayerSessionInfo | null>(null)

  const loadSession = useCallback(async () => {
    const info = await checkPlayerSession()
    if (!info) setPlayerToken(null)
    setSession(info)
    setState(info ? 'accepted' : 'pending')
  }, [])

  useEffect(() => {
    fetchConsent()
      .then(setTexts)
      // Si fallan, se muestran los textos por defecto sin condiciones (el backend
      // seguirá exigiendo las que tenga cargadas al aceptar)
      .catch(() => setTexts({ title: null, intro: null, conditions: [], rejected: { title: null, text: null } }))
  }, [])

  useEffect(() => {
    loadSession().catch(() => setState('pending'))
  }, [loadSession])

  const accept = useCallback(
    async (accepted: number[]) => {
      await acceptConditions(accepted)
      await loadSession()
    },
    [loadSession],
  )

  const requireConsent = useCallback(() => {
    setPlayerToken(null)
    setSession(null)
    setState('pending')
  }, [])

  const logout = useCallback(async () => {
    await closePlayerSession()
    requireConsent()
  }, [requireConsent])

  return (
    <ConsentContext.Provider value={{ state, texts, session, accept, logout, requireConsent }}>{children}</ConsentContext.Provider>
  )
}

export function useConsent() {
  const value = useContext(ConsentContext)
  if (!value) throw new Error('useConsent debe usarse dentro de ConsentProvider')
  return value
}
