// Cliente de la API del backend (mismos endpoints que el frontend actual)

const PLAYER_KEY = 'playerToken'

export function getPlayerToken(): string {
  try {
    return localStorage.getItem(PLAYER_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setPlayerToken(token: string | null) {
  try {
    if (token) localStorage.setItem(PLAYER_KEY, token)
    else localStorage.removeItem(PLAYER_KEY)
  } catch {
    // Sin almacenamiento: la sesión solo dura mientras la página esté abierta
  }
}

// --- Sesión de jugador (aceptación de las condiciones) --------------------------

export interface PlayerSessionInfo {
  id: number
  created_at: string
}

// Datos de la sesión del token guardado, o null si no hay sesión abierta
export async function checkPlayerSession(): Promise<PlayerSessionInfo | null> {
  if (!getPlayerToken()) return null
  const r = await fetch('/api/player/session', { headers: playerHeaders() })
  if (!r.ok) throw new Error('No se ha podido comprobar la sesión.')
  const data = await r.json()
  return data.valid ? { id: data.id, created_at: data.created_at } : null
}

// Cierra la sesión de jugador (logout) y olvida su token
export async function closePlayerSession(): Promise<void> {
  const r = await fetch('/api/player/session', { method: 'DELETE', headers: playerHeaders() })
  // 403: ya no estaba abierta (p. ej. la canceló el administrador); se olvida igualmente
  if (!r.ok && r.status !== 403) throw new Error('No se ha podido cerrar la sesión.')
  setPlayerToken(null)
}

export interface ConsentTexts {
  title: string | null
  intro: string | null
  conditions: { id: number; text: string }[]
  rejected: { title: string | null; text: string | null }
}

// Textos del diálogo de condiciones y de la página de rechazo (de consent.yaml)
export async function fetchConsent(): Promise<ConsentTexts> {
  const r = await fetch('/api/player/consent')
  if (!r.ok) throw new Error('No se han podido cargar las condiciones.')
  return r.json()
}

// Acepta las condiciones: crea la sesión de jugador y guarda su token
export async function acceptConditions(accepted: number[]): Promise<void> {
  const r = await fetch('/api/player/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accepted }),
  })
  if (!r.ok) throw new Error('No se ha podido registrar la aceptación.')
  setPlayerToken((await r.json()).player_token)
}

export interface DayStatus {
  id: number
  unlocked: boolean
  blocked: boolean
}

export interface DayType {
  key: string
  label: string
  image: string | null
}

export interface DayContent {
  id: number
  message: string
  type: DayType
}

export interface DayDetail {
  id: number
  attempts_left: number
  max_attempts: number
  blocked: boolean
  unlocked: boolean
  content: DayContent | null
}

export type UnlockResult =
  | { kind: 'open'; content: DayContent }
  | { kind: 'wrong'; attemptsLeft: number }
  | { kind: 'blocked' }
  | { kind: 'no-session' } // la sesión no existe (p. ej. la canceló el administrador)

export class NotFoundError extends Error {}

// La sesión de jugador no existe (p. ej. la canceló el administrador)
export class NoSessionError extends Error {}

const playerHeaders = () => ({ 'X-Player-Token': getPlayerToken() })

export async function fetchDays(): Promise<DayStatus[]> {
  const r = await fetch('/api/days', { headers: playerHeaders() })
  if (!r.ok) throw new Error('No se han podido cargar los días.')
  return r.json()
}

export async function fetchDay(id: string): Promise<DayDetail> {
  const r = await fetch(`/api/days/${id}`, { headers: playerHeaders() })
  if (r.status === 404) throw new NotFoundError('Este día todavía no tiene contenido.')
  if (!r.ok) throw new Error('No se ha podido cargar el día.')
  return r.json()
}

export async function unlockDay(id: string, password: string): Promise<UnlockResult> {
  const r = await fetch(`/api/days/${id}/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...playerHeaders() },
    body: JSON.stringify({ password }),
  })
  if (r.status === 423) return { kind: 'blocked' }
  if (r.status === 403) return { kind: 'no-session' }
  if (r.status === 401) {
    const data = await r.json()
    return { kind: 'wrong', attemptsLeft: data.detail.attempts_left }
  }
  if (!r.ok) throw new Error('No se ha podido abrir el día.')
  return { kind: 'open', content: await r.json() }
}

// --- Bienvenida -----------------------------------------------------------------

export type WelcomeBlock = { text: string } | { list: string[] }

export interface WelcomeSection {
  heading: string
  content: WelcomeBlock[]
}

export interface Welcome {
  title: string
  subtitle: string | null
  intro: string | null
  sections: WelcomeSection[]
}

export async function fetchWelcome(): Promise<Welcome> {
  const r = await fetch('/api/welcome')
  if (!r.ok) throw new Error('No se ha podido cargar la bienvenida.')
  return r.json()
}

// --- Juego de pruebas -----------------------------------------------------------

export type ChallengeStatus = 'success' | 'fail' | 'ignore'

export interface ChallengeGame {
  title: string
  intro: string
  closing: string | null
  challenges: { id: string; status: ChallengeStatus | null }[]
}

export interface Challenge {
  id: string
  description: string
  status: ChallengeStatus | null
}

export async function fetchChallenges(): Promise<ChallengeGame> {
  const r = await fetch('/api/challenges', { headers: playerHeaders() })
  if (!r.ok) throw new Error('No se ha podido cargar el juego de pruebas.')
  return r.json()
}

export async function fetchChallenge(id: string): Promise<Challenge> {
  const r = await fetch(`/api/challenges/${encodeURIComponent(id)}`, { headers: playerHeaders() })
  if (r.status === 404) throw new NotFoundError('Esta prueba no existe.')
  if (!r.ok) throw new Error('No se ha podido cargar la prueba.')
  return r.json()
}

export async function setChallengeStatus(id: string, status: ChallengeStatus): Promise<void> {
  const r = await fetch(`/api/challenges/${encodeURIComponent(id)}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...playerHeaders() },
    body: JSON.stringify({ status }),
  })
  if (r.status === 403) throw new NoSessionError('Hay que aceptar las condiciones.')
  if (!r.ok) throw new Error('No se ha podido guardar el estado.')
}
