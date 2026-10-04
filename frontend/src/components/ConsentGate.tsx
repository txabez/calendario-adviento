import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Loader2, ScrollText } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Page } from '@/components/Page'
import { RichText } from '@/components/RichText'
import { UserMenu } from '@/components/UserMenu'
import { useConsent } from '@/lib/consent'

// Protege las páginas de la app: hasta aceptar las condiciones solo se ve el diálogo.
// Los textos y las condiciones vienen de consent.yaml (a través del backend).
export function ConsentGate() {
  const { state, texts, accept } = useConsent()
  const navigate = useNavigate()
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (state === 'accepted')
    return (
      <>
        <UserMenu />
        <Outlet />
      </>
    )

  if (state === 'checking' || !texts)
    return (
      <Page className="justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </Page>
    )

  const conditions = texts.conditions
  const allChecked = conditions.every((c) => checked[c.id])

  async function onAccept() {
    setSending(true)
    setError(null)
    try {
      await accept(conditions.map((c) => c.id))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <Page>
      {/* Siempre abierto: no se cierra con Escape ni pulsando fuera */}
      <AlertDialog open>
        <AlertDialogContent onEscapeKeyDown={(e) => e.preventDefault()}>
          <AlertDialogHeader className="items-center text-center sm:items-center sm:text-center">
            <div className="mb-2 flex size-14 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary shadow-glow">
              <ScrollText className="size-7" />
            </div>
            <AlertDialogTitle className="font-display text-xl font-normal tracking-[0.15em] uppercase">
              {texts.title ?? 'Antes de empezar'}
            </AlertDialogTitle>
            {texts.intro && (
              <AlertDialogDescription className="whitespace-pre-line">
                <RichText text={texts.intro} />
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>

          <div className="flex flex-col gap-3">
            {conditions.map((c) => (
              <Label
                key={c.id}
                htmlFor={`condition-${c.id}`}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 leading-snug font-normal transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
              >
                <Checkbox
                  id={`condition-${c.id}`}
                  checked={!!checked[c.id]}
                  onCheckedChange={(value) => setChecked((prev) => ({ ...prev, [c.id]: value === true }))}
                  className="mt-0.5"
                />
                <span className="whitespace-pre-line">
                  <RichText text={c.text} />
                </span>
              </Label>
            ))}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <AlertDialogFooter>
            <Button variant="outline" onClick={() => navigate('/sin-acceso')} disabled={sending}>
              Rechazar
            </Button>
            <Button onClick={onAccept} disabled={!allChecked || sending} className="shadow-glow">
              {sending && <Loader2 className="animate-spin" />}
              Aceptar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  )
}
