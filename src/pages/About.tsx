/**
 * About — the founder story.
 *
 * This page used to be a clinician-facing pitch ("Continuous Recovery
 * Intelligence"), which is why it was kept out of the sitemap: it read like
 * every other health app and said nothing only this site could say.
 *
 * What it says now is the one thing no competitor can copy — the app exists
 * because of a specific person, and every fix in it came from watching him
 * use it. In health content that first-hand experience is the strongest
 * quality signal there is, and it happens to also be the truth.
 *
 * EDITING RULE: every concrete detail here must be something that actually
 * happened. A fabricated specific on a page whose whole value is credibility
 * would cost more than a vague one.
 */

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Mic, Printer, Gamepad2 } from 'lucide-react';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { useSeoMeta } from '@/hooks/useSeoMeta';
import { aboutPageSchema, personSchema, FOUNDER } from '@/lib/seo/structuredData';

const TITLE = 'About NeuroSpark — Why a Son Built Speech Practice for His Father';
const DESCRIPTION =
  'NeuroSpark is voice-driven speech and language practice for stroke survivors with aphasia. It was built by one person for his father after a stroke, and rewritten around what actually happened when they practiced together.';

export default function About() {
  useSeoMeta({
    title: TITLE,
    description: DESCRIPTION,
    canonicalPath: '/about',
    jsonLd: [
      aboutPageSchema({ path: '/about', name: TITLE, description: DESCRIPTION }),
      personSchema(),
    ],
  });

  return (
    <MarketingLayout>
      <article className="container max-w-3xl px-4 py-8 space-y-10">
        <header className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
            I built this for my dad
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            NeuroSpark is speech and language practice for adults after a
            stroke. It exists because of one person, and almost everything in
            it changed because of what happened when he used it.
          </p>
        </header>

        <section className="space-y-4 text-base leading-relaxed">
          <p>
            After my father's stroke, the hardest part to watch wasn't the
            things he couldn't do. It was the moments when he knew exactly
            what he wanted to say and couldn't reach the word. The thought was
            all there. The route to it wasn't.
          </p>
          <p>
            That's aphasia, and the thing nobody warns you about is the
            arithmetic of it. Speech therapy is an hour or two a week if
            you're lucky with scheduling and insurance. Everything else —
            the actual hours where practice would happen — is at home, with
            family, with no plan. We were told practice between sessions
            mattered enormously. We were not told what to do in them.
          </p>
          <p>
            So it was photocopied worksheets that somebody had to remember to
            make, done at a kitchen table, with nobody sure whether an answer
            counted. I started building something so that the practice would
            be there whether or not I had the time that week to prepare it.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">What it turned into</h2>
          <div className="space-y-4 text-base leading-relaxed">
            <p>
              Short sessions you do out loud. You say the answer instead of
              tapping it, because saying it is the part conversation actually
              needs — and it's the part paper can't practice. A guide voice
              runs the session, so a person can do it alone if they want to,
              without a family member having to run it for them.
            </p>
            <p>
              The difficulty moves. If word finding is the hard part on a
              given day, the session shifts toward word finding; support
              fades as it stops being needed and comes back when it is.
              Sessions are deliberately short, because fatigue after a stroke
              is real and a session that runs too long undoes the good the
              first five minutes did.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Everything here was found the same way</h2>
          <p className="text-base leading-relaxed">
            I watched him play, wrote down every place the app got in his
            way, and fixed them. That list is the actual development history:
          </p>
          <ul className="space-y-3 text-base leading-relaxed list-none pl-0">
            <li className="flex gap-3">
              <span className="text-primary font-bold shrink-0">—</span>
              <span>
                He answered a question about jobs with{' '}
                <strong className="text-foreground">"plumbing"</strong> and the
                app marked it wrong. It was looking for "plumber." That is not
                a wrong answer, and a person who has just fought to produce a
                word should never be told it was.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-primary font-bold shrink-0">—</span>
              <span>
                He said the right word and it wasn't heard, because the
                microphone was still closed while the app finished talking.
                Now the app waits for him instead of the other way round.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-primary font-bold shrink-0">—</span>
              <span>
                He said the right word imperfectly and got marked wrong. Now a
                near-miss on the sounds counts as the reach it is.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-primary font-bold shrink-0">—</span>
              <span>
                He wanted to stop for a minute and couldn't find the pause
                button, because it was sitting underneath the header. And the
                text was too small, so now he can make it bigger mid-session.
              </span>
            </li>
          </ul>
          <p className="text-base leading-relaxed text-muted-foreground">
            None of those are clever features. They're the difference between
            a person finishing a session and a person deciding the thing is
            broken and not coming back to it. You only find them by sitting
            next to somebody while they use it.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-muted/40 p-5 space-y-2">
          <h2 className="text-lg font-bold">What I am not</h2>
          <p className="text-sm leading-relaxed">
            I'm not a speech-language pathologist, and NeuroSpark is not
            medical treatment. It is practice — the between-sessions part —
            and it is meant to sit alongside care from a licensed clinician,
            never to replace it. If speech changes are new or sudden, that's a
            doctor, not an app. If you're working with a speech therapist,
            show them anything here and let them tell you which parts suit the
            person you're practicing with. They know things I don't.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Why so much of it is free</h2>
          <p className="text-base leading-relaxed">
            Because the version of this that would have helped us most was the
            one we could have found and used the same evening, without a
            signup, at eleven o'clock at night when we finally had a minute.
            The games play free in the browser. The practice pack is a PDF
            with no email gate — print it, copy it, hand it to your support
            group or your therapist.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button asChild variant="outline" className="justify-start">
              <Link to="/free-aphasia-games">
                <Gamepad2 className="h-4 w-4 mr-2" /> Free games
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/aphasia-sentence-exercises">
                <Mic className="h-4 w-4 mr-2" /> Sentence practice
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/free-aphasia-worksheets">
                <Printer className="h-4 w-4 mr-2" /> Printable pack
              </Link>
            </Button>
          </div>
        </section>

        <section className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5 space-y-3">
          <h2 className="text-xl font-bold">If you're in the middle of this</h2>
          <p className="text-sm leading-relaxed">
            If you're the family member who just got handed a discharge packet
            and no plan, I know exactly where you are. Try a session with the
            person you're caring for. If something in it gets in their way,
            tell me — that's how every part of this got fixed, and it's still
            the only way I find out.
          </p>
          <Button asChild>
            <Link to="/auth">
              Start a free session <ArrowRight className="h-4 w-4 ml-1.5" />
            </Link>
          </Button>
        </section>

        <footer className="border-t pt-5 text-sm text-muted-foreground leading-relaxed">
          <p>
            <span className="font-semibold text-foreground">{FOUNDER.name}</span>{' '}
            — {FOUNDER.description}
          </p>
        </footer>
      </article>
    </MarketingLayout>
  );
}
