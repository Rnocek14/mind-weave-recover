import type { Guide } from './types';

export const guide: Guide = {
  slug: 'how-long-should-speech-practice-be',
  title: 'How Long Should Home Speech Practice Be After a Stroke?',
  h1: 'How long should home speech practice be?',
  description:
    'Why short, frequent speech practice usually beats long sessions after a stroke, how to spot the point where practice stops helping, and how to build a routine that lasts.',
  updated: '2026-08-19',
  standfirst:
    'For families told that practice between therapy sessions matters, and not told how much.',
  related: [
    '/guides/first-weeks-after-stroke-communication',
    '/free-aphasia-games',
    '/free-aphasia-worksheets',
  ],
  body: `
Almost everyone gets told the same thing on the way out: practice between
sessions matters. Almost nobody gets told for how long.

So people guess, and the guess is usually wrong in the same direction. You care
enormously, you have a finite window of energy and motivation, and you spend it
in one big push — forty-five minutes on a Sunday, everyone exhausted by the
end, nothing at all until the following Sunday.

There isn't a single correct number, and anyone who gives you one without
meeting the person is guessing too. But there are some things worth knowing
before you pick.

## The thing that decides it is fatigue

Fatigue after a stroke is not ordinary tiredness. It arrives faster, it hits
harder, and it does something that ordinary tiredness doesn't: it flattens
performance while the person is still trying just as hard.

That matters for practice because of what a session actually teaches. Fifteen
good minutes teach that this is doable. Fifteen good minutes followed by
fifteen minutes past the wall teach that it ends badly — and that lesson is the
one that decides whether tomorrow's session happens at all.

So the useful question isn't "how long can they keep going?" It's "how long can
they keep going *well*?" Stop before the answer changes.

## Short and frequent, if you have to choose

If the same total time can be spent either way, spread it out. Five minutes
most days is a routine. Forty minutes once a week is an event, and events get
cancelled.

There are practical reasons this tends to hold up:

- **The first minutes are the best minutes.** You get the highest-quality
  practice at the start of a session, so more starts means more good minutes.
- **Short is survivable on a bad day.** "We'll do five minutes" happens on days
  when "we'll do our session" absolutely doesn't.
- **Spacing helps things stick.** Practice spread across days generally holds
  better than the same practice crammed into one — which is why the app pulls
  material back in on later days rather than drilling it once.

A speech-language pathologist who knows the person can set a target that fits
them, and their number beats anything on this page. If you have one, ask.

## How to tell you've gone too long

You will usually see it before you hear it:

- Answers get shorter, then stop
- Longer and longer pauses before each attempt
- More "I don't know" — not as an answer, as an exit
- Irritation, or going quiet, or wanting to leave the table
- A task they did easily ten minutes ago suddenly not working

That last one is the clearest signal there is. When something that was working
stops working, the session is over. Not "one more". Over.

## End it on something that worked

If you take one thing from this page, take this one.

The last thing that happens is what gets remembered, and what gets remembered
decides whether there's a next session. So don't end on the hard item. When
you can see it's near the end, go back to something they can do, let them do
it, and stop there.

This feels like cheating. It isn't. You're not measuring them, you're building
a habit — and the habit is worth more over a year than any single hard item is
worth today.

## Building a routine that survives a bad week

**Tie it to something that already happens.** After breakfast. After the
morning coffee. A time of day is a weaker anchor than an existing habit.

**Make the floor tiny.** The commitment should be something achievable on the
worst realistic day. Five minutes. Two exercises. If it's small enough that
skipping it feels sillier than doing it, it survives.

**Protect the mornings if mornings are better.** Most people have a window
where this is easier. Spend the practice there and don't apologize for it.

**Let bad days be bad days.** A missed day is a missed day. A missed day
treated as a failure is how the whole thing stops.

## What we built, and why it's short

The sessions in this app run about eight minutes, and that number came from
watching my father use it, not from a study. Longer sessions kept ending in the
place you don't want to end.

The [free games](/free-aphasia-games) are shorter still — about two minutes
each, no account, playable right now — precisely so that "let's just try one"
is a small enough ask to say yes to. The
[printable pack](/free-aphasia-worksheets) is laid out one task per page for
the same reason: a page you can finish is better than a page you abandon.

None of it is treatment, and none of it replaces a speech therapist. It's for
the hours in between, which is where nearly all of the hours are.

## The honest summary

Start shorter than you think. Do it more often than feels meaningful. Watch
the person rather than the clock. Stop while it's still going well, and end on
something that worked.

Consistency is doing more work here than intensity, and consistency is mostly
a question of whether the last session was bearable.
`.trim(),
  faq: [
    {
      q: 'How long should a home speech practice session be after a stroke?',
      a: 'There is no single right number, and a speech-language pathologist who knows the person can set a better one than any web page. As a starting point, most families do better with short, frequent sessions than long ones — the practical test is how long the person can keep going well, not how long they can keep going.',
    },
    {
      q: 'Is it better to practice every day or do one long session a week?',
      a: 'Spread out, if the same total time can be spent either way. The first minutes of a session are the best minutes, short sessions survive bad days, and practice spaced across days generally holds better than the same practice crammed into one.',
    },
    {
      q: 'How do I know when to stop a practice session?',
      a: 'Watch for shorter answers, longer pauses, more "I don\'t know" as an exit, irritation, or — the clearest signal — a task they did easily ten minutes ago suddenly not working. When something that was working stops working, the session is over.',
    },
    {
      q: 'Should we finish on a hard exercise or an easy one?',
      a: 'An easy one. The last thing that happens is what gets remembered, and what gets remembered decides whether there is a next session. Going back to something they can do and stopping there is not cheating — it is how the habit survives.',
    },
  ],
};
