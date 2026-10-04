import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FadeIn, Page, PageTitle } from '@/components/Page'
import { RichText } from '@/components/RichText'
import { fetchWelcome, type Welcome as WelcomeData } from '@/lib/api'

export default function Welcome() {
  const [page, setPage] = useState<WelcomeData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchWelcome()
      .then(setPage)
      .catch((e: Error) => setError(e.message))
  }, [])

  if (error) return <Page className="justify-center">{error}</Page>
  if (!page)
    return (
      <Page className="justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </Page>
    )

  return (
    <Page>
      <PageTitle title={page.title} subtitle={page.subtitle} />

      {page.intro && (
        <FadeIn delay={0.15} className="mt-8 max-w-2xl text-center text-lg leading-relaxed whitespace-pre-line text-muted-foreground">
          <RichText text={page.intro} />
        </FadeIn>
      )}

      <div className="mt-10 flex w-full max-w-2xl flex-col gap-5">
        {page.sections.map((section, i) => (
          <FadeIn key={i} delay={0.25 + i * 0.1}>
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-xl font-normal tracking-[0.15em] uppercase">
                  {section.heading}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 leading-relaxed text-muted-foreground">
                {section.content.map((block, j) =>
                  'list' in block ? (
                    <ul key={j} className="flex flex-col gap-2">
                      {block.list.map((item, k) => (
                        <li key={k} className="flex gap-3 whitespace-pre-line">
                          <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary shadow-glow" />
                          <span>
                            <RichText text={item} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p key={j} className="whitespace-pre-line">
                      <RichText text={block.text} />
                    </p>
                  ),
                )}
              </CardContent>
            </Card>
          </FadeIn>
        ))}
      </div>

      <FadeIn delay={0.4} className="mt-10">
        <Button asChild size="lg" className="h-12 px-8 font-display tracking-[0.2em] uppercase shadow-glow">
          <Link to="/calendario">
            Continuar <ArrowRight />
          </Link>
        </Button>
      </FadeIn>
    </Page>
  )
}
