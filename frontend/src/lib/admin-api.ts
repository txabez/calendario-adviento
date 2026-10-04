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

export interface PlayerSession {
  id: number
  created_at: string
  last_seen_at: string
  closed_at: string | null
  unlocked_days: number[]
  blocked_days: number[]
  challenges_success: number
  challenges_fail: number
  challenges_ignore: number
}

export interface PlayerDetail {
  id: number
  max_attempts: number
  days: { id: number; type_label: string; attempts_left: number; unlocked_at: string | null }[]
  challenges: { id: string; status: 'success' | 'fail' | 'ignore' | null; updated_at: string | null }[]
}

export type UploadKind = 'days' | 'welcome' | 'challenges' | 'consent'

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
    // Sesiones de jugador: cada una tiene su estado de días y de pruebas
    players: () => call<{ challenges_total: number; players: PlayerSession[] }>('/players'),
    player: (id: number) => call<PlayerDetail>(`/players/${id}`),
    resetPlayerDay: (id: number, day: number) => call(`/players/${id}/days/${day}/reset`, { method: 'POST' }),
    blockPlayerDay: (id: number, day: number) => call(`/players/${id}/days/${day}/block`, { method: 'POST' }),
    resetPlayerChallenges: (id: number) => call(`/players/${id}/challenges/reset`, { method: 'POST' }),
    closePlayer: (id: number) => call(`/players/${id}`, { method: 'DELETE' }),
    upload: (kind: UploadKind, content: string) =>
      call<Record<string, number>>(`/${kind}/upload`, { method: 'POST', json: { content } }),
  }
}

export type AdminApi = ReturnType<typeof adminApi>
