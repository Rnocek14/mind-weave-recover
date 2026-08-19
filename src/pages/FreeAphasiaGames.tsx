/**
 * FreeAphasiaGames — public, indexable landing page with three short,
 * playable, no-signup practice sessions.
 *
 * This is the SEO cornerstone page: the content answers "free aphasia games /
 * speech practice after stroke" searches with games that actually run in the
 * page, not just text about games. Keep every claim in practice/exercise
 * language — no treatment or recovery-outcome promises.
 */

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Ear, Timer, ArrowRight, Heart } from 'lucide-react';
import { DemoDetective } from '@/components/demo/DemoDetective';
import { DemoMinimalPairs } from '@/components/demo/DemoMinimalPairs';
import { DemoWordFinding } from '@/components/demo/DemoWordFinding';
import { useSeoMeta } from '@/hooks/useSeoMeta';

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'What kinds of games help with aphasia practice?',
    a: 'Speech-language pathologists commonly use word-finding (naming) tasks, listening discrimination, sentence repair, and comprehension activities. The games on this page are short practice versions of those same task types: word finding, sound discrimination, and story comprehension.',
  },
  {
    q: 'Can I practice at home between therapy sessions?',
    a: 'Yes — most speech therapists encourage structured home practice between sessions, and many people see the most day-to-day practice time happen at home. Apps make that practice easier to do consistently and let a family member take part. Home practice complements professional therapy; it does not replace it.',
  },
  {
    q: 'Are these games really free?',
    a: 'Everything on this page plays free, with no account and no download. The full app adds voice-based play (speak your answers instead of tapping), a therapy voice that guides each session, difficulty that adapts to the person playing, and progress tracking you can share with a therapist.',
  },
  {
    q: 'Who are these exercises for?',
    a: 'They were built for adults working on speech and language after a stroke — especially word-finding difficulty (anomia) and aphasia — and for the family members practicing alongside them. Sessions are deliberately short so practice fits the energy someone actually has.',
  },
];

export default function FreeAphasiaGames() {
  useSeoMeta({
    title: 'Free Aphasia Games — Play Speech Practice Games Online, No Signup',
    description:
      'Three free speech practice games for stroke survivors with aphasia: word finding, listening, and comprehension. Play right now in your browser — no account, no download.',
    canonicalPath: '/free-aphasia-games',
  });

  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container max-w-4xl px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-semibold">NeuroRecover</Link>
          <Button asChild size="sm">
            <Link to="/auth">Try the full app</Link>
          </Button>
        </div>
      </header>

      <main className="container max-w-4xl px-4 py-8 space-y-10">
        {/* Hero */}
        <section className="text-center space-y-3 max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
            Free aphasia games you can play right now
          </h1>
          <p className="text-muted-foreground text-lg">
            Three short speech practice sessions for stroke survivors — word
            finding, listening, and comprehension. No signup, no download.
            Each takes about two minutes.
          </p>
        </section>

        {/* Playable demos */}
        <section className="grid gap-6 md:grid-cols-1 lg:grid-cols-1 max-w-2xl mx-auto w-full">
          <Card id="word-finding" className="border-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Timer className="h-5 w-5 text-primary" />
                Word-Finding Sprint
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                The classic naming exercise: how many words in a category can
                you find? Practices the retrieval that aphasia makes hard.
              </p>
            </CardHeader>
            <CardContent><DemoWordFinding /></CardContent>
          </Card>

          <Card id="listening" className="border-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Ear className="h-5 w-5 text-primary" />
                Sound Detective (Minimal Pairs)
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Hear a word, tap the matching picture. Practices telling apart
                similar-sounding words — a core listening skill after stroke.
              </p>
            </CardHeader>
            <CardContent><DemoMinimalPairs /></CardContent>
          </Card>

          <Card id="comprehension" className="border-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Search className="h-5 w-5 text-primary" />
                Detective Mind (Story Comprehension)
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Read a three-line story, find the clue, answer the question.
                Practices the comprehension skills used in everyday conversation.
              </p>
            </CardHeader>
            <CardContent><DemoDetective /></CardContent>
          </Card>
        </section>

        {/* Why / story */}
        <section className="max-w-2xl mx-auto space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" /> Why this exists
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            NeuroRecover started as a home project: an app built for my dad
            after his stroke, so he could practice between speech therapy
            sessions without worksheets piling up on the kitchen table. It grew
            into a full practice companion — games you play by <em>speaking</em>,
            a guide voice that runs each session, difficulty that adapts to the
            person playing, and progress a family member or therapist can
            actually see. These free games are small pieces of it.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Everything here is practice support, not medical treatment. If
            speech changes are new or sudden, talk to a doctor; for a therapy
            plan, a licensed speech-language pathologist is the right person.
          </p>
        </section>

        {/* What the full app adds */}
        <section className="max-w-2xl mx-auto space-y-3">
          <h2 className="text-2xl font-bold">What the full app adds</h2>
          <ul className="space-y-2 text-muted-foreground">
            <li>• <strong>Speak your answers</strong> — the app listens, understands what you were reaching for, and never marks a good attempt wrong for imperfect pronunciation</li>
            <li>• <strong>Nine practice games</strong> covering naming, sentences, describing, retelling, and listening</li>
            <li>• <strong>Short guided sessions</strong> that adapt to energy and ability, with a voice that explains everything</li>
            <li>• <strong>Targeting</strong> — over time, sessions focus on the words and sounds the person finds hardest</li>
            <li>• <strong>Progress you can see</strong> — for you, your family, and your therapist</li>
          </ul>
          <div className="pt-2">
            <Button asChild size="lg">
              <Link to="/auth">
                Start practicing free <ArrowRight className="h-4 w-4 ml-1.5" />
              </Link>
            </Button>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-2xl mx-auto space-y-4 pb-10">
          <h2 className="text-2xl font-bold">Common questions</h2>
          {FAQ.map((f) => (
            <div key={f.q} className="space-y-1">
              <h3 className="font-semibold">{f.q}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.a}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground space-x-3">
        <Link to="/about" className="hover:text-foreground">About</Link>
        <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
        <Link to="/terms" className="hover:text-foreground">Terms</Link>
      </footer>
    </div>
  );
}
