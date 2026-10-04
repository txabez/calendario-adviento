// Cliente de la API del backend (mismos endpoints que el frontend actual)

const PLAYER_KEY = 'playerToken'

export function getPlayerToken(): string {
  try {
    return localStorage.getItem(PLAYER_KEY) ?? ''
  } catch {
    return ''
  }
}

function setPlayerToken(token: string) {
  try {
    localStorage.setItem(PLAYER_KEY, token)
  } catch {
    // Sin almacenamiento: los días se recuerdan solo mientras la página esté abierta
  }
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

export class NotFoundError extends Error {}

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
  if (r.status === 401) {
    const data = await r.json()
    return { kind: 'wrong', attemptsLeft: data.detail.attempts_left }
  }
  if (!r.ok) throw new Error('No se ha podido abrir el día.')
  const { player_token, ...content } = await r.json()
  setPlayerToken(player_token)
  return { kind: 'open', content }
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
  challenges: { id: string; status: ChallengeStatus | null }[]
}

export interface Challenge {
  id: string
  description: string
  status: ChallengeStatus | null
}

export async function fetchChallenges(): Promise<ChallengeGame> {
  const r = await fetch('/api/challenges')
  if (!r.ok) throw new Error('No se ha podido cargar el juego de pruebas.')
  return r.json()
}

export async function fetchChallenge(id: string): Promise<Challenge> {
  const r = await fetch(`/api/challenges/${encodeURIComponent(id)}`)
  if (r.status === 404) throw new NotFoundError('Esta prueba no existe.')
  if (!r.ok) throw new Error('No se ha podido cargar la prueba.')
  return r.json()
}

export async function setChallengeStatus(id: string, status: ChallengeStatus): Promise<void> {
  const r = await fetch(`/api/challenges/${encodeURIComponent(id)}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  if (!r.ok) throw new Error('No se ha podido guardar el estado.')
}
