import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FadeIn, Page, PageTitle } from '@/components/Page'
import { RichText } from '@/components/RichText'
import { fetchChallenges, type ChallengeGame } from '@/lib/api'

// Página principal del juego de pruebas: explicación y botón para continuar
export default function ChallengesIntro() {
  const [game, setGame] = useState<ChallengeGame | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchChallenges()
      .then(setGame)
      .catch((e: Error) => setError(e.message))
  }, [])

  if (error) return <Page className="justify-center">{error}</Page>
  if (!game)
    return (
      <Page className="justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </Page>
    )

  return (
    <Page className="justify-center">
      <PageTitle title={game.title} />
      <FadeIn delay={0.15} className="mt-8 max-w-2xl text-center text-lg leading-relaxed whitespace-pre-line text-muted-foreground">
        <RichText text={game.intro} />
      </FadeIn>
      <FadeIn delay={0.3} className="mt-10">
        <Button asChild size="lg" className="h-12 px-8 font-display tracking-[0.2em] uppercase shadow-glow">
          <Link to="/pruebas/lista">
            Continuar <ArrowRight />
          </Link>
        </Button>
      </FadeIn>
    </Page>
  )
}
