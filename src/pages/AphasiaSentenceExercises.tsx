/**
 * AphasiaSentenceExercises — public SEO page targeting sentence-completion /
 * sentence-repair practice queries, answered with a playable session.
 *
 * Copy discipline: practice language only, no treatment or outcome claims,
 * and every "what therapists do" statement stays general rather than
 * prescribing a plan. Further reading points at primary organizations
 * (ASHA / NIDCD / NAA) rather than fabricated study citations.
 */

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Printer, Wrench } from 'lucide-react';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { DemoFixSentence } from '@/components/demo/DemoFixSentence';
import { useSeoMeta } from '@/hooks/useSeoMeta';

const CUE_LADDER: Array<{ step: string; say: string; why: string }> = [
  {
    step: 'Wait',
    say: '(say nothing for 10 seconds)',
    why: 'Word retrieval after a stroke is slow before it is impossible. Silence is the most useful thing a partner can offer, and the hardest.',
  },
  {
    step: 'Point at the problem',
    say: '“Something in there isn’t right — can you find it?”',
    why: 'Locating the error is its own skill, separate from repairing it.',
  },
  {
    step: 'Give the category',
    say: '“It should be something you drive.”',
    why: 'A semantic cue narrows the search without handing over the word.',
  },
  {
    step: 'Give the first sound',
    say: '“It starts with wh…”',
    why: 'A phonemic cue is often the smallest push that still leaves the retrieval to them.',
  },
  {
    step: 'Offer a choice',
    say: '“Is it a wheel or a window?”',
    why: 'Recognition is easier than recall — this keeps the turn successful.',
  },
  {
    step: 'Model it, then hand it back',
    say: '“Wheel. Can you say the whole sentence?”',
    why: 'Ending on their own production matters more than who supplied the word.',
  },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'What are sentence completion exercises for aphasia?',
    a: 'They are practice activities where a sentence is incomplete or contains a wrong word, and the person fills in or repairs it. Because the sentence supplies context, they sit between single-word naming (easier) and open conversation (harder), which is why speech-language pathologists often use them as a bridge between the two.',
  },
  {
    q: 'Should the answer be spoken or written?',
    a: 'Both are useful and they exercise different things. Speaking practices the retrieval-plus-production chain that conversation needs; writing removes the timing pressure. The demo above accepts typing; the full app is built around saying the answer out loud.',
  },
  {
    q: 'What if they say the whole sentence instead of just the word?',
    a: 'That should count — and in the practice above it does. Saying the full corrected sentence is harder than saying the single word, so an exercise that only accepts a bare word marks the more advanced answer wrong. This is the single most common complaint about speech apps, and it is why the matcher here accepts the word, the phrase around it, the full sentence, or a plural.',
  },
  {
    q: 'How often should someone practice?',
    a: 'Short and frequent generally beats long and rare, and consistency matters more than any single session — but the right amount depends entirely on the person, their fatigue, and their stage of recovery. A speech-language pathologist can set a realistic target; sessions here are deliberately two to five minutes so practice fits the energy someone actually has.',
  },
  {
    q: 'Is this a replacement for speech therapy?',
    a: 'No. These are practice activities for between sessions. Diagnosis, goal setting, and a therapy plan belong with a licensed speech-language pathologist.',
  },
];

export default function AphasiaSentenceExercises() {
  useSeoMeta({
    title: 'Sentence Completion Exercises for Aphasia — Free & Playable',
    description:
      'Free sentence completion and sentence repair practice for aphasia after stroke. Play a short session right now — no signup — plus a caregiver cueing guide and printable worksheets.',
    canonicalPath: '/aphasia-sentence-exercises',
  });

  return (
    <MarketingLayout>
      <div className="container max-w-3xl px-4 py-8 space-y-10">
        <section className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
            Sentence completion exercises for aphasia
          </h1>
          {/* Extractable answer, kept high on the page. */}
          <p className="text-lg text-muted-foreground leading-relaxed">
            Sentence exercises give the brain a running start: the sentence
            supplies context, so the missing word is easier to reach than it
            would be from a blank page. That makes them a natural step between
            naming single words and holding a conversation. Below is a free
            four-sentence session you can play right now — no account, no
            download — plus the cueing ladder a practice partner can use and a
            printable version for off-screen days.
          </p>
        </section>

        <section>
          <Card className="border-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wrench className="h-5 w-5 text-primary" />
                Fix the Sentence — free practice session
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Each sentence has one wrong word. Type the word that fixes it —
                or type the whole corrected sentence. Both count.
              </p>
            </CardHeader>
            <CardContent><DemoFixSentence /></CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">How to help without giving the answer</h2>
          <p className="text-muted-foreground leading-relaxed">
            The hardest part of practicing with someone you love is not
            finishing their sentences. A cueing ladder solves that: start at the
            top and only move down a rung when they stall. Every rung down gives
            a little more help, so the person keeps as much of the retrieval as
            they can still do themselves.
          </p>
          <ol className="space-y-3">
            {CUE_LADDER.map((c, i) => (
              <li key={c.step} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold">{c.step}</p>
                  <p className="text-sm italic text-muted-foreground">{c.say}</p>
                  <p className="text-sm text-muted-foreground">{c.why}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Three levels, and when to move up</h2>
          <div className="grid gap-3">
            {[
              {
                level: 'Level 1 — obvious mismatch',
                example: '“The dog wagged its book.”',
                note: 'The wrong word is from a completely different category. Move up when they find and fix these without cues.',
              },
              {
                level: 'Level 2 — plausible but wrong',
                example: '“I cut the paper with a banana.”',
                note: 'The sentence still makes grammatical sense, so the error has to be caught on meaning. Move up when cues are rarely needed.',
              },
              {
                level: 'Level 3 — subtle and longer',
                example: '“He gathered his fishing pole, a tackle box, some bait, and a piano before heading to the lake.”',
                note: 'Longer sentences load memory as well as language. If frustration climbs, drop back a level — a level that is too hard teaches nothing.',
              },
            ].map((l) => (
              <div key={l.level} className="rounded-lg border p-4">
                <p className="font-semibold">{l.level}</p>
                <p className="text-sm mt-1">{l.example}</p>
                <p className="text-sm text-muted-foreground mt-1">{l.note}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            In the full app these levels adjust on their own, based on how the
            last few answers went — so nobody has to decide when to move up.
          </p>
        </section>

        <section className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5 space-y-3">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Printer className="h-5 w-5 text-primary" /> Prefer paper?
          </h2>
          <p className="text-sm text-muted-foreground">
            The same sentences, in large print with an answer key and a page of
            cueing scripts for the practice partner — free, no email required.
          </p>
          <Button asChild variant="outline">
            <Link to="/free-aphasia-worksheets">
              Get the printable worksheets <ArrowRight className="h-4 w-4 ml-1.5" />
            </Link>
          </Button>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Practice it out loud instead</h2>
          <p className="text-muted-foreground leading-relaxed">
            Typing removes the part that conversation actually requires: getting
            the word out of your mouth. The full version of this exercise is
            spoken — you say the answer, the app listens, and it credits the
            word you were reaching for even when it comes out distorted. It also
            reads each sentence aloud, tracks which sentences give trouble, and
            brings those back later.
          </p>
          <Button asChild size="lg">
            <Link to="/auth">Start practicing free <ArrowRight className="h-4 w-4 ml-1.5" /></Link>
          </Button>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Common questions</h2>
          {FAQ.map((f) => (
            <div key={f.q} className="space-y-1">
              <h3 className="font-semibold">{f.q}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.a}</p>
            </div>
          ))}
        </section>

        <section className="space-y-2 text-sm text-muted-foreground">
          <h2 className="text-lg font-bold text-foreground">Where to learn more</h2>
          <ul className="space-y-1">
            <li>
              <a className="underline hover:text-foreground" href="https://www.asha.org/public/speech/disorders/aphasia/" target="_blank" rel="noopener noreferrer">
                American Speech-Language-Hearing Association — Aphasia
              </a>
            </li>
            <li>
              <a className="underline hover:text-foreground" href="https://www.nidcd.nih.gov/health/aphasia" target="_blank" rel="noopener noreferrer">
                National Institute on Deafness and Other Communication Disorders — Aphasia
              </a>
            </li>
            <li>
              <a className="underline hover:text-foreground" href="https://aphasia.org/" target="_blank" rel="noopener noreferrer">
                National Aphasia Association
              </a>
            </li>
          </ul>
        </section>
      </div>
    </MarketingLayout>
  );
}
