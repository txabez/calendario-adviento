import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { FileUp, Loader2, Lock, LockOpen, LogOut, RotateCcw, Settings2, ShieldCheck, Trash2, Trophy } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  type PlayerDetail,
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

const STATUS_LABELS = {
  success: { label: 'Superada', className: 'border-success text-success' },
  fail: { label: 'Fallida', className: 'border-destructive text-destructive' },
  ignore: { label: 'Ignorada', className: 'text-muted-foreground' },
} as const

function Panel({ token, onLogout }: { token: string; onLogout: () => void }) {
  const api = useMemo(() => adminApi(token), [token])
  const [error, setError] = useState<string | null>(null)
  const [players, setPlayers] = useState<{ total: number; list: PlayerSession[] } | null>(null)
  const [open, setOpen] = useState<number | null>(null) // sesión desplegada
  const [busy, setBusy] = useState<string | null>(null)
  const [upload, setUpload] = useState<UploadResult | null>(null)
  const [version, setVersion] = useState(0) // cambia tras cada acción para recargar el detalle

  // Ejecuta una llamada; si la sesión de admin caduca, vuelve al login
  const run = useCallback(
    async <T,>(key: string | null, action: (api: AdminApi) => Promise<T>) => {
      setBusy(key)
      try {
        return await action(api)
      } catch (e) {
        if (e instanceof SessionExpiredError) onLogout()
        else if (!(e instanceof YamlErrors)) setError((e as Error).message)
        throw e
      } finally {
        setBusy(null)
      }
    },
    [api, onLogout],
  )

  const refresh = useCallback(() => {
    setVersion((v) => v + 1)
    run(null, (a) => a.players())
      .then((p) => setPlayers({ total: p.challenges_total, list: p.players }))
      .catch(() => {})
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
      if (e instanceof YamlErrors) setUpload({ ok: false, text: `${file.name}: ${e.message}`, errors: e.errors })
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
            label="Cargar condiciones"
            busy={busy === 'upload-consent'}
            onFile={(f) => uploadYaml('consent', f, (r) => `cargadas ${r.conditions} condiciones`)}
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

      <Section
        title="Sesiones de jugador"
        description="Cada navegador que ha aceptado las condiciones. Cada sesión tiene sus propios intentos, días abiertos y pruebas."
      >
        {!players && <Loader2 className="size-6 animate-spin text-muted-foreground" />}
        {players && players.list.length === 0 && (
          <p className="text-muted-foreground">Nadie ha aceptado todavía las condiciones.</p>
        )}
        {players && players.list.length > 0 && (
          <ul className="flex flex-col gap-3">
            {players.list.map((p) => {
              const played = p.challenges_success + p.challenges_fail + p.challenges_ignore
              const expanded = open === p.id
              return (
                <li key={p.id} className={cn('rounded-xl border transition-colors', expanded && 'border-primary')}>
                  <div className="flex flex-wrap items-center gap-3 p-3">
                    <span className="w-10 text-right font-display text-lg text-muted-foreground">#{p.id}</span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap gap-1.5">
                        {p.closed_at && (
                          <Badge variant="secondary">
                            <LogOut /> Cerrada
                          </Badge>
                        )}
                        <Badge variant="outline">
                          <LockOpen /> {p.unlocked_days.length} abiertos
                        </Badge>
                        {p.blocked_days.length > 0 && (
                          <Badge variant="destructive">
                            <Lock /> {p.blocked_days.length} bloqueados
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-muted-foreground">
                          <Trophy /> {played}/{players.total} pruebas
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Aceptó las condiciones: {formatDate(p.created_at)} ·{' '}
                        {p.closed_at
                          ? `Cerrada por el jugador: ${formatDate(p.closed_at)}`
                          : `Última actividad: ${formatDate(p.last_seen_at)}`}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant={expanded ? 'default' : 'outline'} onClick={() => setOpen(expanded ? null : p.id)}>
                        <Settings2 /> Gestionar
                      </Button>
                      <ConfirmButton
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        disabled={busy === `player-${p.id}`}
                        title={`¿Cancelar la sesión #${p.id}?`}
                        description="Se borra todo su estado (días e intentos, y pruebas). Ese navegador tendrá que volver a aceptar las condiciones y empezar de cero."
                        confirmLabel="Cancelar sesión"
                        onConfirm={() => act(`player-${p.id}`, (a) => a.closePlayer(p.id))}
                      >
                        <Trash2 /> Cancelar
                      </ConfirmButton>
                    </div>
                  </div>
                  {expanded && (
                    <PlayerManager key={`${p.id}-${version}`} id={p.id} run={run} act={act} busy={busy} />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Section>
    </Page>
  )
}

// Días y pruebas de una sesión de jugador
function PlayerManager({
  id,
  run,
  act,
  busy,
}: {
  id: number
  run: <T>(key: string | null, action: (a: AdminApi) => Promise<T>) => Promise<T>
  act: (key: string, action: (a: AdminApi) => Promise<unknown>) => void
  busy: string | null
}) {
  const [detail, setDetail] = useState<PlayerDetail | null>(null)

  useEffect(() => {
    run(null, (a) => a.player(id))
      .then(setDetail)
      .catch(() => {})
  }, [id, run])

  if (!detail)
    return (
      <div className="border-t p-4">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )

  const played = detail.challenges.filter((c) => c.status).length

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="border-t p-3">
      <Tabs defaultValue="days">
        <TabsList className="w-full">
          <TabsTrigger value="days">Días</TabsTrigger>
          <TabsTrigger value="challenges">Pruebas</TabsTrigger>
        </TabsList>

        <TabsContent value="days">
          <ul className="flex flex-col">
            {detail.days.map((day, i) => {
              const blocked = day.attempts_left <= 0
              const full = day.attempts_left >= detail.max_attempts
              const key = `day-${id}-${day.id}`
              return (
                <li key={day.id}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center gap-3 py-2.5">
                    <span className={cn('w-7 text-right font-display text-lg', blocked && 'text-destructive')}>{day.id}</span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate text-sm">{day.type_label}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {blocked ? (
                          <Badge variant="destructive">
                            <Lock /> Bloqueado
                          </Badge>
                        ) : (
                          <>
                            {day.unlocked_at && (
                              <Badge>
                                <LockOpen /> Abierto
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-muted-foreground">
                              Intentos: {day.attempts_left}/{detail.max_attempts}
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={full || busy === key}
                        onClick={() => act(key, (a) => a.resetPlayerDay(id, day.id))}
                      >
                        <RotateCcw /> Resetear
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        disabled={blocked || busy === key}
                        onClick={() => act(key, (a) => a.blockPlayerDay(id, day.id))}
                      >
                        <Lock /> Bloquear
                      </Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </TabsContent>

        <TabsContent value="challenges">
          {detail.challenges.length === 0 && <p className="py-2 text-muted-foreground">No hay pruebas cargadas.</p>}
          <ul className="flex flex-col">
            {detail.challenges.map((c, i) => {
              const status = c.status ? STATUS_LABELS[c.status] : null
              return (
                <li key={c.id}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center gap-3 py-2.5">
                    <span className="min-w-7 text-right font-display text-lg break-all">{c.id}</span>
                    <Badge variant="outline" className={status ? status.className : 'text-muted-foreground'}>
                      {status ? status.label : 'Pendiente'}
                    </Badge>
                  </div>
                </li>
              )
            })}
          </ul>
          {detail.challenges.length > 0 && (
            <ConfirmButton
              variant="outline"
              className="mt-3"
              disabled={busy === `challenges-${id}` || played === 0}
              title={`¿Resetear las pruebas de la sesión #${id}?`}
              description="Todas sus pruebas volverán a estar pendientes. Las de las demás sesiones no cambian."
              confirmLabel="Resetear"
              onConfirm={() => act(`challenges-${id}`, (a) => a.resetPlayerChallenges(id))}
            >
              <RotateCcw /> Resetear pruebas
            </ConfirmButton>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
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
