import type { Guide } from './types';

export const guide: Guide = {
  slug: 'first-weeks-after-stroke-communication',
  title: 'Talking With Someone in the First Weeks After a Stroke',
  h1: 'Talking with someone in the first weeks after a stroke',
  description:
    'Practical ways to keep talking with a family member whose speech has changed after a stroke — what helps in a hospital room, what to stop doing, and what nobody warns you about.',
  updated: '2026-08-19',
  intent: 'situational',
  standfirst:
    'Written for the person sitting in the chair beside the bed, who has just realized that talking is going to be different now.',
  related: [
    '/guides/helping-someone-find-a-word',
    '/guides/how-long-should-speech-practice-be',
    '/free-aphasia-games',
  ],
  body: `
Nobody prepares you for the first conversation.

You've spent days worrying about whether they'd survive it, and then they're
awake, and you say something ordinary, and what comes back isn't what you
expected. Maybe nothing comes back at all. Maybe words come back but the wrong
ones, delivered with total confidence. Whatever it is, the ground moves.

This page is about the weeks after that. Not the medicine — your care team owns
that, and this isn't a substitute for a word of it — but the part nobody hands
you a leaflet about: how to keep talking to someone whose talking has changed.

## First, the thing that helps most

**Assume they understand more than they can say.**

Producing language and understanding it are different jobs, handled by
different machinery, and they are very often damaged to different degrees. A
person who can't get a sentence out may be following every word in the room —
including the conversation happening over their bed about them.

So: talk to them, not about them. Include them. If a nurse asks you a question
about them while they're right there, look at them first. This is not
sentimental. It is the single most consistent piece of advice you will hear
from people who have been through it themselves, and the cost of getting it
wrong in the other direction is enormous.

## What tends to help

**Short sentences, normal voice.** Simplify the structure, not the dignity.
Slower and clearer is useful; louder and sing-song is not — they aren't deaf
and they aren't a child, and both come across.

**One idea at a time.** "Do you want water?" lands. "Do you want water, or
should I get the nurse, or are you too warm?" is three questions wearing a
trench coat.

**Yes-or-no questions when things are hard.** They cost far less to answer than
open ones, and a run of successful exchanges is worth more on a bad day than
one heroic sentence.

**Pen and paper. Or a phone.** Writing, pointing, drawing, showing a photo,
gesturing — all of it counts. The goal is the idea getting across, not the
route it takes.

**Turn off the television.** Background noise makes every exchange harder in a
way that's easy to underestimate.

**Give it time.** Ten seconds of silence is a long time to sit in, and it is
often exactly what's needed. There's a fuller version of this in
[how to help someone find a word](/guides/helping-someone-find-a-word).

## What tends not to help

**"Take your time"** — said while visibly not having time. It's readable.

**Asking them to repeat something they just managed.** It converts a success
into a test.

**Correcting the small stuff.** If the idea arrived, the sentence worked.

**Quizzing.** "Who's this? Do you know who I am? What's my name?" is
well-meant and it lands as an exam, at a moment when failing one is
devastating.

**Filling every silence.** Some of the silence is them working.

## The thing nobody warns you about

The exhaustion.

Fatigue after a stroke is not ordinary tiredness and it doesn't behave like it.
It arrives suddenly, it flattens performance completely, and someone who was
managing whole sentences at eleven in the morning may have nothing left at two
in the afternoon. This is not them giving up, and it is not a relapse.

Practically, this means the same conversation genuinely is harder later in the
day, and that a visit which starts wonderfully can end badly simply because it
ran twenty minutes too long. Short and frequent beats long and heroic —
including for you.

## About the crying, and the anger

Emotions can run very close to the surface after a stroke, sometimes in ways
that don't match how the person actually feels — laughing or crying that
arrives out of proportion and passes quickly. It can be alarming the first
time, and it's worth asking the care team about rather than reading anything
into it.

Separately and just as real: the frustration is legitimate. Somebody who knows
exactly what they want to say and cannot say it is not being difficult. I found
it useful to say out loud, occasionally, "I know you know. Take your time." Not
as a technique — just because it was true and it seemed to help.

## What to ask the speech therapist

If a speech-language pathologist is involved, you have a limited number of
minutes with an expert and it's worth spending them well. Things worth asking:

- What kind of difficulty is this, in plain words?
- What can I do at home, specifically, between your sessions?
- What should I *stop* doing?
- How do I know if I'm pushing too hard?
- What does a realistic good week look like from here?

Write the answers down. You will not remember them.

And if practice at home is on the list, ask them to look at whatever you plan
to use, including anything here.

## Practicing at home, when you get there

At some point the hospital ends and the practice moves to your kitchen table,
usually with far less support than you expected. That's the gap this whole site
exists for: my father's, and then everyone else's.

The [free games](/free-aphasia-games) are two-minute sessions you can try
tonight without an account. The [printable pack](/free-aphasia-worksheets)
works on paper, with scripts telling a practice partner exactly what to say.
Neither is treatment, and neither replaces the therapist — they're for the
hours between.

## The honest part

The first weeks are the worst weeks for information. You're making decisions
while exhausted, on advice that arrives in fragments, about a condition you'd
never heard described in detail until a few days ago.

Two things are worth knowing. Progress is real and it is often slow and uneven
enough that you can't see it week to week — it is much easier to see when you
look back a few months. And you're allowed to just sit with them. Not every
visit has to be therapy. Sometimes the most useful thing in the room is
somebody who isn't asking them to perform.
`.trim(),
  faq: [
    {
      q: 'Can they understand me if they cannot speak?',
      a: 'Very often, yes — much more than they can say. Understanding language and producing it are different jobs and are frequently damaged to different degrees. Assume they follow more than they can express: talk to them rather than about them, and include them in conversations happening in the room.',
    },
    {
      q: 'Should I speak louder or slower?',
      a: 'Slower and clearer helps. Louder does not — this is a language difficulty, not a hearing one, and both loudness and a sing-song tone come across as talking down. Keep your normal voice and simplify the sentence structure instead.',
    },
    {
      q: 'Why are they so much worse in the afternoon?',
      a: 'Fatigue after a stroke is not ordinary tiredness. It can arrive suddenly and flatten performance completely, so the same task genuinely is harder later in the day. Short, frequent contact tends to work better than long visits.',
    },
    {
      q: 'What should I ask the speech therapist?',
      a: 'What kind of difficulty this is in plain words; what to do at home between sessions; what to stop doing; how to tell if you are pushing too hard; and what a realistic good week looks like. Write the answers down — you will not remember them.',
    },
  ],
};
