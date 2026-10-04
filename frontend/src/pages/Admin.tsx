import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { FileUp, Loader2, Lock, LogOut, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ConfirmButton } from '@/components/ConfirmButton'
import { Page } from '@/components/Page'
import { PasswordInput } from '@/components/PasswordInput'
import {
  SessionExpiredError,
  YamlErrors,
  adminApi,
  loadAdminToken,
  login,
  saveAdminToken,
  type AdminApi,
  type AdminDay,
  type ChallengesSummary,
  type PlayerSession,
  type UploadKind,
} from '@/lib/admin-api'
import { cn } from '@/lib/utils'

export default function Admin() {
  const [token, setToken] = useState(loadAdminToken)

  const changeToken = useCallback((value: string | null) => {
    saveAdminToken(value)
    setToken(value)
  }, [])

  return token ? <Panel token={token} onLogout={() => changeToken(null)} /> : <Login onLogin={changeToken} />
}

function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSending(true)
    setError(null)
    try {
      onLogin(await login(username, password))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <Page className="justify-center">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <Card>
          <CardHeader className="items-center text-center">
            <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary shadow-glow">
              <ShieldCheck className="size-7" />
            </div>
            <CardTitle className="font-display text-2xl font-normal tracking-[0.15em] uppercase">Administración</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="username">Usuario</Label>
                <Input
                  id="username"
                  className="h-11"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Contraseña</Label>
                <PasswordInput
                  id="password"
                  className="h-11 text-base tracking-normal"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" size="lg" className="mt-2 h-11 shadow-glow" disabled={sending}>
                {sending && <Loader2 className="animate-spin" />}
                Entrar
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </Page>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
}

function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg font-normal tracking-[0.15em] uppercase">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </motion.div>
  )
}

type UploadResult = { ok: boolean; text: string; errors?: string[] }

function Panel({ token, onLogout }: { token: string; onLogout: () => void }) {
  const api = useMemo(() => adminApi(token), [token])
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState<{ max: number; list: AdminDay[] } | null>(null)
  const [players, setPlayers] = useState<PlayerSession[] | null>(null)
  const [challenges, setChallenges] = useState<ChallengesSummary | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [upload, setUpload] = useState<UploadResult | null>(null)

  // Ejecuta una llamada; si la sesión caduca, vuelve al login
  const run = useCallback(
    async <T,>(key: string | null, action: (api: AdminApi) => Promise<T>) => {
      setBusy(key)
      try {
        return await action(api)
      } catch (e) {
        if (e instanceof SessionExpiredError) onLogout()
        else setError((e as Error).message)
        throw e
      } finally {
        setBusy(null)
      }
    },
    [api, onLogout],
  )

  const refresh = useCallback(() => {
    run(null, async (a) => {
      const [d, p, c] = await Promise.all([a.days(), a.players(), a.challenges()])
      setDays({ max: d.max_attempts, list: d.days })
      setPlayers(p.players)
      setChallenges(c)
    }).catch(() => {})
  }, [run])

  useEffect(refresh, [refresh])

  const act = (key: string, action: (a: AdminApi) => Promise<unknown>) =>
    run(key, action).then(refresh).catch(() => {})

  async function uploadYaml(kind: UploadKind, file: File, describe: (r: Record<string, number>) => string) {
    setUpload(null)
    try {
      const content = await file.text()
      const result = await run(`upload-${kind}`, (a) => a.upload(kind, content))
      setUpload({ ok: true, text: `${file.name}: ${describe(result)}` })
      refresh()
    } catch (e) {
      if (e instanceof YamlErrors) {
        setError(null)
        setUpload({ ok: false, text: `${file.name}: ${e.message}`, errors: e.errors })
      }
    }
  }

  function logout() {
    api.logout().catch(() => {})
    onLogout()
  }

  return (
    <Page className="gap-6">
      <div className="flex w-full items-center justify-between">
        <h1 className="font-display text-2xl font-light tracking-[0.15em] uppercase drop-shadow-[var(--glow)] sm:text-3xl">
          Administración
        </h1>
        <Button variant="ghost" onClick={logout} className="text-muted-foreground">
          <LogOut /> Salir
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      )}

      <Section title="Cargar contenido" description="Elige el fichero YAML. Si tiene errores no se carga nada.">
        <div className="flex flex-wrap gap-2">
          <YamlButton
            label="Cargar días"
            busy={busy === 'upload-days'}
            onFile={(f) =>
              uploadYaml('days', f, (r) => `cargados ${r.loaded} días y ${r.types} tipos` + (r.deleted ? `, borrados ${r.deleted} días` : ''))
            }
          />
          <YamlButton
            label="Cargar bienvenida"
            busy={busy === 'upload-welcome'}
            onFile={(f) => uploadYaml('welcome', f, (r) => `bienvenida cargada (${r.sections} secciones)`)}
          />
          <YamlButton
            label="Cargar pruebas"
            busy={busy === 'upload-challenges'}
            onFile={(f) =>
              uploadYaml('challenges', f, (r) => `cargadas ${r.loaded} pruebas` + (r.deleted ? `, borradas ${r.deleted}` : ''))
            }
          />
        </div>
        {upload && (
          <Alert variant={upload.ok ? 'default' : 'destructive'} className="mt-4">
            <AlertTitle>{upload.text}</AlertTitle>
            {upload.errors && upload.errors.length > 0 && (
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {upload.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </AlertDescription>
            )}
          </Alert>
        )}
      </Section>

      <Section title="Días">
        {!days && <Loader2 className="size-6 animate-spin text-muted-foreground" />}
        {days && (
          <ul className="flex flex-col">
            {days.list.map((day, i) => {
              const blocked = day.attempts_left <= 0
              const full = day.attempts_left >= days.max
              return (
                <li key={day.id}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center gap-3 py-3">
                    <span
                      className={cn(
                        'w-8 text-right font-display text-xl',
                        blocked ? 'text-destructive' : 'text-foreground',
                      )}
                    >
                      {day.id}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate text-sm font-medium">{day.type_label}</span>
                      {blocked ? (
                        <Badge variant="destructive" className="gap-1">
                          <Lock /> Bloqueado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Intentos: {day.attempts_left}/{days.max}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={full || busy === `day-${day.id}`}
                        onClick={() => act(`day-${day.id}`, (a) => a.resetDay(day.id))}
                      >
                        <RotateCcw /> Resetear
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        disabled={blocked || busy === `day-${day.id}`}
                        onClick={() => act(`day-${day.id}`, (a) => a.blockDay(day.id))}
                      >
                        <Lock /> Bloquear
                      </Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      <Section title="Juego de pruebas">
        {!challenges && <Loader2 className="size-6 animate-spin text-muted-foreground" />}
        {challenges && challenges.total === 0 && <p className="text-muted-foreground">No hay pruebas cargadas.</p>}
        {challenges && challenges.total > 0 && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ['Superadas', challenges.success, 'text-success'],
                  ['Fallidas', challenges.fail, 'text-destructive'],
                  ['Ignoradas', challenges.ignore, 'text-muted-foreground'],
                  ['Pendientes', challenges.pending, 'text-foreground'],
                ] as const
              ).map(([label, value, color]) => (
                <div key={label} className="rounded-lg border bg-background/40 p-3 text-center">
                  <div className={cn('font-display text-2xl', color)}>{value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
            <ConfirmButton
              variant="outline"
              className="self-start"
              disabled={busy === 'challenges' || challenges.pending === challenges.total}
              title="¿Resetear todas las pruebas?"
              description="Todas las pruebas volverán a estar pendientes. Las pruebas no se borran."
              confirmLabel="Resetear"
              onConfirm={() => act('challenges', (a) => a.resetChallenges())}
            >
              <RotateCcw /> Resetear pruebas
            </ConfirmButton>
          </div>
        )}
      </Section>

      <Section title="Sesiones de jugador" description="Cada navegador que ha abierto algún día.">
        {!players && <Loader2 className="size-6 animate-spin text-muted-foreground" />}
        {players && players.length === 0 && <p className="text-muted-foreground">Todavía no se ha abierto ningún día.</p>}
        {players && players.length > 0 && (
          <ul className="flex flex-col">
            {players.map((p, i) => (
              <li key={p.id}>
                {i > 0 && <Separator />}
                <div className="flex items-center gap-3 py-3">
                  <span className="w-10 text-right font-display text-lg text-muted-foreground">#{p.id}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {p.unlocked_days.length ? `Días abiertos: ${p.unlocked_days.join(', ')}` : 'Sin días abiertos'}
                    </span>
                    <span className="text-xs text-muted-foreground">Inicio: {formatDate(p.created_at)}</span>
                    <span className="text-xs text-muted-foreground">Última actividad: {formatDate(p.last_seen_at)}</span>
                  </div>
                  <ConfirmButton
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    disabled={busy === `player-${p.id}`}
                    title={`¿Cancelar la sesión #${p.id}?`}
                    description="Sus días volverán a pedir la contraseña."
                    confirmLabel="Cancelar sesión"
                    onConfirm={() => act(`player-${p.id}`, (a) => a.closePlayer(p.id))}
                  >
                    <Trash2 /> Cancelar
                  </ConfirmButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </Page>
  )
}

// Botón que abre el selector de ficheros y entrega el YAML elegido
function YamlButton({ label, busy, onFile }: { label: string; busy: boolean; onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <Loader2 className="animate-spin" /> : <FileUp />}
        {label}
      </Button>
      <input
        ref={input}
        type="file"
        accept=".yaml,.yml"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = '' // permite volver a elegir el mismo fichero
          if (file) onFile(file)
        }}
      />
    </>
  )
}
