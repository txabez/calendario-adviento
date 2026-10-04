// Cliente de los endpoints de administración (/api/admin)

const TOKEN_KEY = 'adminToken'

export function loadAdminToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function saveAdminToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // Sin almacenamiento: la sesión solo dura mientras la página esté abierta
  }
}

export class SessionExpiredError extends Error {}

export class YamlErrors extends Error {
  constructor(public errors: string[]) {
    super('El YAML tiene errores, no se ha cargado nada:')
  }
}

export async function login(username: string, password: string): Promise<string> {
  const r = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (r.status === 401) throw new Error('Usuario o contraseña incorrectos')
  if (!r.ok) throw new Error('No se ha podido iniciar sesión')
  return (await r.json()).token
}

export interface AdminDay {
  id: number
  attempts_left: number
  type_label: string
}

export interface PlayerSession {
  id: number
  created_at: string
  last_seen_at: string
  unlocked_days: number[]
}

export interface ChallengesSummary {
  total: number
  success: number
  fail: number
  ignore: number
  pending: number
}

export type UploadKind = 'days' | 'welcome' | 'challenges'

// Crea un cliente que añade el token a cada petición
export function adminApi(token: string) {
  async function call<T>(path: string, init: { method?: string; json?: unknown } = {}): Promise<T> {
    const r = await fetch(`/api/admin${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.json !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
    })
    if (r.status === 401) throw new SessionExpiredError('La sesión ha caducado')
    if (r.status === 400) throw new YamlErrors((await r.json()).detail?.errors ?? [])
    if (!r.ok) throw new Error('Error al hablar con el servidor')
    return r.json()
  }

  return {
    logout: () => call('/logout', { method: 'POST' }),
    days: () => call<{ max_attempts: number; days: AdminDay[] }>('/days'),
    resetDay: (id: number) => call(`/days/${id}/reset`, { method: 'POST' }),
    blockDay: (id: number) => call(`/days/${id}/block`, { method: 'POST' }),
    players: () => call<{ players: PlayerSession[] }>('/players'),
    closePlayer: (id: number) => call(`/players/${id}`, { method: 'DELETE' }),
    challenges: () => call<ChallengesSummary>('/challenges'),
    resetChallenges: () => call('/challenges/reset', { method: 'POST' }),
    upload: (kind: UploadKind, content: string) =>
      call<Record<string, number>>(`/${kind}/upload`, { method: 'POST', json: { content } }),
  }
}

export type AdminApi = ReturnType<typeof adminApi>
