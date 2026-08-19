import type { Guide } from './types';

export const guide: Guide = {
  slug: 'free-aphasia-resources',
  title: 'Free Aphasia Resources That Do Not Need an Account',
  h1: 'Free aphasia resources worth knowing about',
  description:
    'Where to find genuinely free help after a stroke — the organizations worth contacting, what they actually provide, and how to tell a real free resource from a trial.',
  updated: '2026-08-19',
  intent: 'resource',
  standfirst:
    'What exists, what it costs, and which things are free in the way you hoped rather than free for fourteen days.',
  related: [
    '/free-aphasia-worksheets',
    '/free-aphasia-games',
    '/guides/speech-exercises-at-home-after-stroke',
  ],
  body: `
Search for aphasia help and most of what comes back is a free trial. That's a
particular kind of unhelpful when you're at the point of looking things up at
eleven at night.

Here's what's actually out there, grouped by what it does. I've been honest
about which things are ours.

## Organizations worth contacting

These are non-profits and professional bodies, not products. All of them
publish plain-language material and none of them will ask for a card.

**The National Aphasia Association** ([aphasia.org](https://www.aphasia.org))
— US-based, focused specifically on aphasia rather than stroke generally.
Explainer material written for families, and a directory of support groups,
which is the part most people find most useful.

**The American Speech-Language-Hearing Association**
([asha.org](https://www.asha.org)) — the professional body for
speech-language pathologists in the US. Their public-facing pages are the
closest thing to an authoritative plain-language reference on what these
conditions are, and they have a tool for finding a certified clinician near
you.

**The American Stroke Association** ([stroke.org](https://www.stroke.org)) —
broader than aphasia, and strong on the part nobody prepares you for:
navigating discharge, caregiving, and the practical mess of the first months.

**Your hospital or rehab unit.** The least glamorous and often the highest
value. Ask directly whether there's a local aphasia group, a community stroke
group, or a university speech clinic nearby. Which brings me to:

**University speech-language clinics.** Many universities with a
speech-language pathology program run a clinic where students treat clients
under supervision, at low or no cost. Availability varies enormously and there
are often waiting lists, but almost nobody thinks to ask, and it can mean
real, ongoing, supervised therapy for a fraction of the private cost. Search
for speech-language pathology programs in your state and call the department.

**Aphasia support groups.** Ask the organizations above, or the rehab team.
For the person with aphasia it is a room where nobody is impatient. For the
family member it is a room where you don't have to explain the background.
Both matter more than they sound.

## How to spot a resource that isn't actually free

A few tells, learned the annoying way:

- **"Free" that requires a card.** If you enter payment details, it's a trial.
- **A download that costs an email address.** Not a scandal, but it means the
  thing is a lead magnet, and lead magnets are usually thin.
- **Free to start, paid to continue.** Common and often legitimate — just know
  which one you're looking at before you build a routine on it.
- **Content aimed at clinicians, sold as family material.** If it uses
  assessment names without explaining them, it wasn't written for you.

Nothing wrong with paying for something good. It's the discovering-later part
that costs you a bad evening.

## What we make, and what it costs

Being direct, since this is our site.

**[The printable practice pack](/free-aphasia-worksheets)** — a PDF with
sentence repair, word-finding sprints, riddles, listening pairs, a caregiver
cueing guide and an answer key. Large print, one task per page, black and
white so it prints cheaply. **No email address, no account.** Print it, copy
it, hand it to your support group or your therapist. If a clinic wants it
adapted, ask.

**[The free games](/free-aphasia-games)** — three practice sessions that play
in the browser, about two minutes each. **No signup, no download.**

**The full app** — voice-driven sessions where you say answers out loud,
difficulty that adapts, and progress you can share with a therapist. That one
is the product, and it has an account behind it.

Everything above is practice, not treatment, and none of it replaces a
speech-language pathologist.

## The thing that's free and nobody lists

Talking to them.

Not as therapy — as conversation. Ordinary, unhurried, about nothing much,
with the television off and enough time for a pause. Most of the hours in a
week are these hours, and the way they go matters more than any resource on
this page.

There's a short guide to making that easier at
[talking with someone in the first weeks after a stroke](/guides/first-weeks-after-stroke-communication),
and the practical version of the same thing at
[how to help someone find a word](/guides/helping-someone-find-a-word).

## If you have a speech therapist

Show them what you're planning to use, including anything here. They know
things about the person in front of them that no general resource can, and
they'll tell you in thirty seconds whether something is a good use of your
week or a waste of it.

If you don't have one, ASHA's directory above is the place to start, and the
university clinic route is the one most people never hear about.
`.trim(),
  faq: [
    {
      q: 'Where can I find free aphasia resources?',
      a: 'The National Aphasia Association, ASHA and the American Stroke Association all publish free plain-language material and directories with no account required. Local aphasia support groups and university speech-language clinics — which often treat at low or no cost under supervision — are the two most valuable and least-known options.',
    },
    {
      q: 'Are there free aphasia worksheets that do not need an email address?',
      a: 'Yes. The printable practice pack on this site downloads with no email address and no account, and it can be printed, copied and shared freely, including with a therapist or a support group.',
    },
    {
      q: 'How do I tell whether something is really free?',
      a: 'Watch for four tells: it asks for a card, it costs an email address, it is free to start and paid to continue, or it is clinician material sold as family material. None of those are scandals, but it is better to know which one you are looking at before building a routine on it.',
    },
    {
      q: 'Is there free or low-cost speech therapy?',
      a: 'Many universities with a speech-language pathology program run clinics where students treat clients under supervision at low or no cost. Availability and waiting lists vary a great deal, but very few families think to ask. Search for speech-language pathology programs in your state and call the department directly.',
    },
  ],
};
