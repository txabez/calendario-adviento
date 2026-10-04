import { Link } from 'react-router-dom'
import { ShieldX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FadeIn, Page, PageTitle } from '@/components/Page'
import { RichText } from '@/components/RichText'
import { useConsent } from '@/lib/consent'

// Página a la que se llega al rechazar las condiciones (textos de consent.yaml)
export default function NoAccess() {
  const { texts } = useConsent()
  const title = texts?.rejected.title ?? 'No puedes continuar'
  const text = texts?.rejected.text ?? 'Para participar es necesario aceptar las condiciones.'

  return (
    <Page className="justify-center">
      <FadeIn className="mb-6 flex size-20 items-center justify-center rounded-full border border-destructive/50 bg-destructive/10 text-destructive">
        <ShieldX className="size-10" />
      </FadeIn>
      <PageTitle title={title} />
      <FadeIn delay={0.15} className="mt-6 max-w-md text-center text-lg whitespace-pre-line text-muted-foreground">
        <RichText text={text} />
      </FadeIn>
      <FadeIn delay={0.3} className="mt-8">
        <Button asChild variant="outline" size="lg">
          <Link to="/">Volver a las condiciones</Link>
        </Button>
      </FadeIn>
    </Page>
  )
}
