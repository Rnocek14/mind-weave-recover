import type { Guide } from './types';

export const guide: Guide = {
  slug: 'how-long-does-aphasia-recovery-take',
  title: 'How Long Does Aphasia Recovery Take? An Honest Answer',
  h1: 'How long does aphasia recovery take?',
  description:
    'Why nobody online can tell you how long aphasia recovery takes, what actually influences it, what a plateau does and does not mean, and what to ask the clinician who can answer.',
  updated: '2026-08-19',
  intent: 'prognosis',
  standfirst:
    'The most searched question about aphasia, and the one no website should answer with a number.',
  related: [
    '/guides/word-finding-difficulty-after-stroke',
    '/guides/how-long-should-speech-practice-be',
    '/guides/aphasia-apraxia-dysarthria',
  ],
  body: `
This is the question everybody types first, usually within a week, usually
late at night.

I'm not going to give you a number, and I'd be careful of anything that does.
Here's why, and here's what can honestly be said instead.

## Why no website can answer this

How language recovers after a stroke depends on things that vary enormously
from person to person — where the damage is and how much, what the person's
language was like before, their age and general health, what other difficulties
are present alongside, how much therapy they get and when it starts, and
factors nobody can identify from the outside.

Two people whose scans look broadly similar can follow completely different
courses. A page that doesn't know any of this about your person is not in a
position to tell you what happens next, and a confident number from a site that
has never met them is a marketing decision, not a clinical one.

The person who can give you a useful answer is the speech-language pathologist
who has assessed them. Even then it will be a range with caveats, and the
caveats are the honest part.

## What can be said generally

**Change tends to be fastest early and continues after that.** The early period
after a stroke is usually where the steepest changes happen, which is why
therapy tends to start as soon as someone can tolerate it. That does not mean
the door closes afterwards — improvement over much longer timeframes is well
documented, and people do gain ground years later.

**Progress is uneven.** Not a slope. Good weeks, flat weeks, backward weeks,
and days that look like a relapse and are actually fatigue or a cold or a bad
night's sleep. This unevenness is normal and it's the single most demoralizing
thing about watching it up close.

**Some things return before others.** Understanding often improves ahead of
speaking. Automatic speech often comes before deliberate speech. Which is why
a person can seem to follow everything and still not be able to answer.

**Practice is the part you can influence.** You can't change where the damage
is. What's within reach is how much meaningful practice happens between
sessions, which is exactly why every clinician tells you it matters and it's
the entire reason this site exists.

## About plateaus

At some point somebody will use the word plateau, possibly in the context of
insurance coverage ending. It's worth knowing what it does and doesn't mean.

A plateau is a description of a measurement over a period. It is not a
statement that nothing further can change, and the idea that recovery stops at
some fixed point has been challenged for years. People make gains after long
flat periods, often when something changes — new practice, better health, more
motivation, a different approach.

What a plateau frequently means in practice is that *funded therapy* is ending,
which is a different sentence from *improvement is ending*. If you're told
this, worth asking directly: is this a clinical judgment about what's possible,
or a coverage decision? They are not the same conversation, and you're entitled
to know which one you're in.

## What to measure instead of time

Waiting for a milestone that may never arrive on schedule is corrosive. It's
more sustainable to watch things that move on a shorter cycle:

- **Speed.** The same word arriving faster than it did last month.
- **Effort.** Less visible struggle for the same result.
- **Workarounds.** Going around a missing word instead of stopping — this is a
  real skill and it grows.
- **Initiation.** Starting a conversation rather than only answering.
- **Range.** More situations they'll talk in. The shop counts.

Write one number down weekly — the sixty-second category count from
[the home exercises](/guides/speech-exercises-at-home-after-stroke) works well
— and look at it in three months, not daily. Progress after a stroke is usually
too slow and too noisy to see week to week, and looking daily mostly measures
how tired everyone was.

## What to ask the clinician

- What did the assessment actually show?
- Which parts do you expect to be most responsive to practice?
- What should I look for over the next month that would tell me this is working?
- If we hit a flat period, what changes?
- Is there anything I should *stop* doing?

The third one is the most useful and the least asked. A specific, near-term,
observable thing to watch is worth more than any prognosis, because you can
actually check it.

## The part I'd want said to me

Nobody can tell you how this ends. That is genuinely the state of knowledge,
not a professional dodging the question.

What you can do is make the hours between therapy sessions count, keep the
practice short enough to survive a bad week, and notice the small changes,
because those are the ones that are actually visible on a human timescale.

If you want somewhere to start, the [free games](/free-aphasia-games) take
about two minutes and the [printable pack](/free-aphasia-worksheets) needs
nothing but a printer. Neither is treatment. Both are for the in-between.
`.trim(),
  faq: [
    {
      q: 'How long does aphasia recovery take?',
      a: 'There is no answer that applies to an individual, and any specific number from a website is worth very little. It depends on where the damage is and how much, the person\'s language before the stroke, their age and health, what else is affected, and how much therapy they get. A speech-language pathologist who has assessed them can give a range with caveats, and the caveats are the honest part.',
    },
    {
      q: 'Does aphasia improvement stop after the first few months?',
      a: 'Change tends to be fastest early, which is why therapy usually starts as soon as someone can tolerate it — but improvement over much longer timeframes is well documented, and people gain ground years later. The idea that recovery stops at a fixed point has been challenged for years.',
    },
    {
      q: 'What does it mean if they have plateaued?',
      a: 'A plateau describes a measurement over a period; it is not a statement that nothing further can change. It also frequently coincides with funded therapy ending, which is a different thing entirely. If you are told this, it is fair to ask directly whether it is a clinical judgment or a coverage decision.',
    },
    {
      q: 'What should I look for instead of a timeline?',
      a: 'Watch things that move on a shorter cycle: the same word arriving faster, less visible effort for the same result, going around a missing word instead of stopping, starting conversations rather than only answering, and being willing to talk in more situations. Record one number weekly and look at it in three months rather than daily.',
    },
  ],
};
