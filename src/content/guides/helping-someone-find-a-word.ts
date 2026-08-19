import type { Guide } from './types';

export const guide: Guide = {
  slug: 'helping-someone-find-a-word',
  title: 'How to Help Someone With Aphasia Find a Word',
  h1: 'How to help someone find a word',
  description:
    'A step-by-step cueing ladder for helping someone with aphasia reach a word themselves — what to say, in what order, and why waiting ten seconds is the hardest part.',
  updated: '2026-08-19',
  standfirst:
    'For the family member sitting across the table while someone searches for a word, and not sure whether helping helps.',
  related: [
    '/free-aphasia-worksheets',
    '/aphasia-sentence-exercises',
    '/guides/first-weeks-after-stroke-communication',
  ],
  body: `
The instinct is to supply the word. Someone you love is stuck mid-sentence, you
can see the effort, you know exactly what they mean — and saying it ends the
discomfort for both of you in half a second.

The trouble is that the discomfort is where the work happens. Every time
someone reaches a word themselves, the reaching gets slightly easier. Every
time somebody hands it over, the reach doesn't happen. That doesn't make
supplying the word wrong — sometimes it is exactly right, and I'll come back to
when — but it does mean it should be a decision rather than a reflex.

What follows is a ladder. Start at the bottom. Climb one rung at a time, and
only when the rung below hasn't worked.

## Rung 1: Wait

Ten full seconds. Count them.

This is the single highest-value thing a practice partner can do and by a wide
margin the hardest. Ten seconds of silence while somebody you love struggles
feels much longer than ten seconds. Most people last three.

The reason it matters: word finding after a stroke is often not a question of
whether the word is there but how long the route to it takes. Cutting in at
three seconds doesn't just remove the chance to get there — it teaches, over
many repetitions, that the attempt isn't worth starting.

Watch their face rather than the clock. Someone actively searching looks
different from someone who has stopped. If they've stopped, move up a rung. If
they're still going, let them go.

One caveat worth being honest about: for someone with very severe word-finding
difficulty, ten seconds of nothing can be its own kind of defeat. If waiting is
reliably producing frustration rather than words, shorten it. The ladder is a
default, not a rule.

## Rung 2: Say what kind of thing it is

*"It's something in the kitchen."*

A category narrows the search without giving anything away. It's the gentlest
help there is, and often it's all that's needed — the word was close and just
needed a direction.

## Rung 3: Say what it's for

*"It's the thing you use to open a tin."*

Describing the function is a bigger hint than a category but still leaves the
word itself untouched. A lot of people get there on this rung.

## Rung 4: Give the first sound

*"It starts with kuh…"*

The first sound is genuinely powerful — much more so than it sounds like it
should be. Give the sound, not the letter: *"kuh"*, not *"C"*. The route to a
word runs through how it sounds, not how it's spelled.

## Rung 5: Offer a choice of two

*"Is it a tin opener or a corkscrew?"*

Now the task has changed. Recognizing a word is easier than producing one, so
this rung is a real drop in difficulty — which is precisely why it comes late.
Keep both options plausible. A choice between the right word and something
absurd isn't a choice.

## Rung 6: Say the word, and move on warmly

*"Tin opener. Yes — that's a hard one."*

Sometimes the word isn't coming, and the useful thing is to end the search
cleanly rather than let it curdle. Say it, acknowledge the effort, carry on
with the conversation. A session that ends in frustration costs more than the
one word was worth.

## What counts as success

This is the part I got wrong for a long time.

A different sensible answer is a success. If you were fishing for "tin opener"
and they said "the opener thing", they found a way to communicate the idea —
which is the actual goal. Conversation doesn't grade you on precision.

A description instead of a name is a success. "The thing for the tin" is how a
huge number of people work around a word they can't reach, and it works.

The right word said imperfectly is a success. If the sounds came out wrong but
the word was right, they found the word. Correcting the pronunciation at that
moment usually teaches only that being right wasn't enough.

Credit the reach, not just the word.

## Things that quietly make it harder

**Finishing their sentences.** Even when you're right. Especially when you're
right.

**Asking them to repeat.** "Say it again properly" turns a successful
communication into a failed test.

**Background noise.** A television in the room raises the difficulty of every
single exchange. Turn it off before you start.

**Long open questions.** "What did you do today?" is enormously harder than
"Did you go outside today?" Neither is wrong, but know which one you're
asking.

**Rushing.** Not just talking fast — sitting in a way that says you have
somewhere to be. It's readable, and it shortens every answer.

## Practicing this on purpose

You don't have to wait for a word to go missing to practice. Structured
practice gives you both a low-stakes place to use the ladder, where a stuck
word is expected rather than an interruption to real life.

The [printable practice pack](/free-aphasia-worksheets) has this ladder on page
two, next to exercises built to produce exactly these moments. The
[sentence exercises](/aphasia-sentence-exercises) do the same thing out loud,
with the cues built into the app so a partner doesn't have to run them.

## A last thing

Ask the person what they want. Some people want help fast and find waiting
patronising. Some want the silence. Most want different things on different
days, and the same person after a hard morning is not the same person after a
good night's sleep.

You're allowed to ask, "Do you want me to jump in, or do you want to get it?"
It's a better question than any rung on this ladder.

And if a speech-language pathologist is involved, ask them how they want you to
cue. They may want a different order for this particular person, or want you to
skip a rung entirely — and theirs is the version to use. This ladder is what
worked at our kitchen table, not a clinical protocol.
`.trim(),
  faq: [
    {
      q: 'Should I say the word if they are struggling?',
      a: 'Not first. Wait about ten seconds, then give a category, then what it is used for, then the first sound, then a choice of two. If none of that lands, say the word warmly and move on — a session that ends in frustration costs more than the one word was worth.',
    },
    {
      q: 'How long should I wait before helping?',
      a: 'Around ten seconds is a good default, and it will feel much longer than it is. Watch their face rather than the clock: someone still actively searching looks different from someone who has stopped. If waiting is reliably producing frustration rather than words, shorten it.',
    },
    {
      q: 'Is it bad to finish their sentences?',
      a: 'It removes the chance to reach the word, and over many repetitions it can teach that the attempt is not worth starting. It is not a disaster on any single occasion — but it is worth making a decision rather than a reflex.',
    },
    {
      q: 'What if they say a different word than the one I expected?',
      a: 'If it communicates the idea, it worked. A different sensible answer, a description instead of a name, or the right word said imperfectly are all successful word finding. Credit the reach, not just the word.',
    },
  ],
};
