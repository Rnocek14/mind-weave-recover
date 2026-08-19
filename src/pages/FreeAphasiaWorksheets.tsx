/**
 * FreeAphasiaWorksheets — public SEO pillar for printable practice material,
 * paired with the playable versions of the same exercises.
 *
 * No email gate: open PDFs are what actually travel through stroke support
 * groups, and distribution beats capture at this stage.
 */

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Download, Printer, ArrowRight, Check } from 'lucide-react';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { AuthorByline } from '@/components/marketing/AuthorByline';
import { useSeoMeta } from '@/hooks/useSeoMeta';
import { faqPageSchema } from '@/lib/seo/structuredData';
import { buildWorksheetPack } from '@/lib/worksheets/buildWorksheetPack';

const PDF_PATH = '/downloads/neurospark-home-practice-pack.pdf';

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Are these aphasia worksheets really free?',
    a: 'Yes — the whole pack downloads with no email address and no account. Print it, copy it, and share it with anyone who needs it, including your speech therapist or support group.',
  },
  {
    q: 'Who are the worksheets designed for?',
    a: 'Adults practicing speech and language after a stroke, and the family member practicing with them. Everything is set in large print with one task per page, because small dense worksheets are hard to use with vision changes or a weak hand.',
  },
  {
    q: 'Do I need the app to use these?',
    a: 'No. The pack works entirely on paper, including scripts telling a practice partner exactly what to say. Each section also has a QR-free short link to the same exercise as a free playable session, if you would rather do it out loud with instant feedback.',
  },
  {
    q: 'Can speech-language pathologists use these with clients?',
    a: 'Yes, freely — for home programs, waiting rooms, or discharge packets. If you would like the pack adapted (different difficulty mix, larger type, your clinic name on the cover), get in touch.',
  },
];

export default function FreeAphasiaWorksheets() {
  useSeoMeta({
    title: 'Free Aphasia Worksheets (PDF) — Printable Home Practice Pack',
    description:
      'A free printable aphasia worksheet pack for stroke survivors: sentence repair, word-finding sprints, riddles, listening pairs, a caregiver cueing guide, and an answer key. Large print, no email required.',
    canonicalPath: '/free-aphasia-worksheets',
    // The questions below are rendered on the page; the markup only
    // describes what a visitor can actually read.
    jsonLd: [faqPageSchema(FAQ, '/free-aphasia-worksheets')],
  });

  const pack = buildWorksheetPack();
  const sentenceCount = pack.sentences.reduce((n, s) => n + s.items.length, 0);

  const contents = [
    { n: sentenceCount, label: 'Fix-the-Sentence items across three labeled difficulty levels' },
    { n: pack.categories.length, label: 'Word-finding sprint pages with write-in lines' },
    { n: pack.clues.length, label: 'Two-clue riddles' },
    { n: pack.pairs.length, label: 'Listening pairs, written as a read-aloud script for the partner' },
    { n: 1, label: 'Caregiver cueing guide — the six steps of helping without giving the answer' },
    { n: 1, label: 'Two-week practice log, plus a full answer key' },
  ];

  return (
    <MarketingLayout>
      <div className="container max-w-3xl px-4 py-8 space-y-10">
        <section className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
            Free aphasia worksheets (printable PDF)
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            A complete home practice pack for speech and language after a
            stroke: sentence repair, word-finding sprints, riddles, and
            listening pairs — plus the part most worksheets leave out, a guide
            telling the practice partner exactly what to say when their person
            gets stuck. Large print, one task per page, black and white so it
            prints cheaply. No email address required.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button asChild size="lg">
              <a href={PDF_PATH} download>
                <Download className="h-4 w-4 mr-1.5" /> Download the PDF
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/free-aphasia-worksheets/print">
                <Printer className="h-4 w-4 mr-1.5" /> View &amp; print in browser
              </Link>
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">What's inside</h2>
          <ul className="space-y-2">
            {contents.map((c) => (
              <li key={c.label} className="flex gap-2.5 items-start">
                <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span>
                  <strong className="tabular-nums">{c.n}</strong> — {c.label}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Or do the same exercises out loud</h2>
          <p className="text-muted-foreground leading-relaxed">
            Paper is quiet, portable, and never has a dead microphone — but it
            can't tell you whether the answer was right, and it can't practice
            the part that conversation actually needs: saying the word. Every
            section of this pack has a playable twin you can try free, with no
            signup.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button asChild variant="outline" className="justify-start">
              <Link to="/aphasia-sentence-exercises">
                Play the sentence exercises <ArrowRight className="h-4 w-4 ml-auto" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/free-aphasia-games">
                Play word finding &amp; listening <ArrowRight className="h-4 w-4 ml-auto" />
              </Link>
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">How to use the pack</h2>
          <div className="space-y-3 text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground">Start below where you think they are.</strong>{' '}
              An exercise that is slightly too easy builds momentum; one that is
              too hard ends the session. The three sentence levels are labeled so
              you can move up deliberately.
            </p>
            <p>
              <strong className="text-foreground">Watch for fatigue, not the clock.</strong>{' '}
              Fatigue after a stroke is real and it flattens performance fast, so
              many families find shorter, more frequent sessions easier to
              sustain. A speech-language pathologist can set a target that fits
              the person.
            </p>
            <p>
              <strong className="text-foreground">Use the cueing ladder on page 2.</strong>{' '}
              Waiting ten full seconds before helping is the single highest-value
              thing a practice partner can do, and the hardest.
            </p>
            <p>
              <strong className="text-foreground">Credit the reach, not just the word.</strong>{' '}
              A different sensible answer, a description instead of a name, or
              the right word said imperfectly are all successful word finding.
              The answer key says this too.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-muted/40 p-5 space-y-2">
          <h2 className="text-lg font-bold">Before you start</h2>
          <p className="text-sm leading-relaxed">
            These are practice activities, not medical treatment, and they are
            not a substitute for care from a licensed speech-language
            pathologist. The pack was written by the family that built this app,
            not by a clinician. If speech changes are new or sudden, contact a
            doctor — and if you are working with a speech therapist, show them
            the pack so they can tell you which parts suit the person you are
            practicing with.
          </p>
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

        <section className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5 space-y-2">
          <h2 className="text-xl font-bold">Why this pack exists</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            NeuroSpark began as an app built for one man after his stroke, so
            that practice between speech therapy sessions didn't depend on
            photocopied worksheets nobody had time to make. These pages are
            those exercises, on paper, free for anyone who needs them.
          </p>
        </section>

        <AuthorByline />
      </div>
    </MarketingLayout>
  );
}
