import type { Guide } from './types';

export const guide: Guide = {
  slug: 'aphasia-apraxia-dysarthria',
  title: 'Aphasia, Apraxia or Dysarthria? What the Words Mean',
  h1: 'Aphasia, apraxia, dysarthria — what the words mean',
  description:
    'Plain-language explanations of the three speech and language diagnoses families hear most after a stroke, how they differ, and why a person can have more than one at once.',
  updated: '2026-08-19',
  intent: 'definitional',
  standfirst:
    'For anyone who has just been handed a word by a clinician and would like to know what it actually describes.',
  related: [
    '/guides/first-weeks-after-stroke-communication',
    '/guides/helping-someone-find-a-word',
    '/aphasia-sentence-exercises',
  ],
  body: `
Somebody in a hurry says a word to you in a corridor, and you nod, and then you
go home and type it into a search bar and get a wall of clinical writing aimed
at somebody else.

Here are the three words families hear most after a stroke, in plain language.

**One thing up front, and it matters:** only a qualified clinician can say
which of these a person actually has. The descriptions below are to help you
follow a conversation with a speech-language pathologist, not to have it
without them. Diagnoses here are genuinely hard to tell apart from the outside,
and being confidently wrong about which one you're dealing with changes what
you'd do about it.

## Aphasia — a language problem

Aphasia is a difficulty with **language itself**: finding words, putting them
in order, understanding them, reading, writing. The thinking is intact. The
person is exactly as intelligent as they were. What's damaged is the system
that turns thought into language and back.

What families notice:

- Knowing precisely what they want to say and not being able to reach the word
- Reaching for a word and a different one arriving instead
- Sentences that come out short or scrambled
- Difficulty following speech, especially when it's fast or there are several
  people
- Reading and writing affected too — often to a similar degree

The most important thing to know: **understanding and speaking are separate**,
and they're often damaged to different degrees. Somebody who can't produce a
sentence may be following everything in the room. Assume they understand more
than they can say.

Aphasia comes in different patterns — some people speak fluently but the
content doesn't hold together, others produce very few words but understand
well. Your clinician may use a specific name for the pattern. It's worth asking
what it means for daily life rather than what it's called.

## Apraxia of speech — a planning problem

With apraxia of speech, the person knows the word. The muscles work. What's
broken is the **planning between the two** — the instructions that tell the
mouth what to do, in what order, at what speed.

What families notice:

- Visible groping for the shape of a word, mouth searching for a position
- Getting a word out perfectly once and not being able to repeat it
- Automatic speech being easier than deliberate speech — swearing, greetings,
  or counting arriving fluently while a requested word won't
- Errors that move around: the same word coming out differently each attempt
- More trouble with longer words than short ones

That inconsistency is the signature. The person isn't being difficult when the
word works once and then doesn't. That *is* the condition.

## Dysarthria — a muscle problem

Dysarthria is weakness, slowness or poor coordination in the **muscles used to
speak**. The language is fine and the planning is fine. The equipment isn't
doing what it's told.

What families notice:

- Slurred or mumbled speech
- Quiet, breathy, strained or nasal voice
- Slow speech, or speech that runs together
- Consistency — it sounds broadly the same way each time, rather than varying
  attempt to attempt
- Sometimes eating or drinking difficulties too, since it's overlapping
  muscles

Because the language system is untouched, someone with dysarthria alone can
usually write what they want to say without difficulty. That's often the
clearest practical difference from aphasia.

## Telling them apart

A rough guide, and no more than that:

- **Aphasia** — the damage is to language. Writing is usually affected too.
  Words come out wrong or don't come at all.
- **Apraxia of speech** — the damage is to motor planning. Writing is usually
  spared. The same word varies from attempt to attempt.
- **Dysarthria** — the damage is to the muscles. Writing is usually spared.
  Speech sounds similar every time.

The single most useful question you can ask yourself is: **can they write it?**
If the words are available in writing but not in speech, that points away from
aphasia. If the words aren't available in any form, that points toward it.

## Why a person can have more than one

Very often they do. A stroke damages an area, not a category, and the regions
involved in language, in speech planning and in the muscles of the mouth sit
close enough together that one event can affect more than one.

So a person can have aphasia and apraxia of speech. Or dysarthria and aphasia.
This is one of several reasons that working out the diagnosis from the outside
is unreliable — you may be watching two things at once, and what looks like one
explanation is often two overlapping.

## What this changes for you

Less than you might think, and that's genuinely good news. Most of what helps
is the same either way:

- Give it time. Don't fill the silence.
- Cut background noise.
- Short sentences, normal voice — not louder, not sing-song.
- Let any route count. Writing, pointing, gesturing, showing a photo.
- Watch for fatigue and stop before the wall.

Where it does change things is in what practice should target, and that's
exactly the judgment a speech-language pathologist is trained to make.
Practice aimed at word finding is a different activity from practice aimed at
the mouth's motor plan.

## What to ask

- What is this, in plain words?
- Is it one thing or more than one?
- What does that mean for what we practice at home?
- What should I stop doing?
- What does a realistic good month look like?

## Practicing at home

Everything on this site is aimed at the language side — word finding, sentence
repair, listening, comprehension — because that's what my father needed. The
[free games](/free-aphasia-games) and the
[sentence exercises](/aphasia-sentence-exercises) are open, playable, and free
to try.

If the difficulty is mainly motor — apraxia or dysarthria — a speech therapist
will point you at different exercises, and they'll be right. Show them anything
here and let them tell you whether it fits the person you're practicing with.
`.trim(),
  faq: [
    {
      q: 'What is the difference between aphasia and apraxia?',
      a: 'Aphasia is a difficulty with language itself — finding words, ordering them, understanding them — and it usually affects writing too. Apraxia of speech is a difficulty planning the movements for speech: the person knows the word and the muscles work, but the instructions between them fail, so the same word comes out differently on different attempts. Only a clinician can say which is present.',
    },
    {
      q: 'How is dysarthria different from aphasia?',
      a: 'Dysarthria is weakness or poor coordination in the muscles used to speak, so speech sounds slurred, quiet or slow but sounds broadly the same way each time. Language is intact, which is why someone with dysarthria alone can usually write what they want to say. Aphasia affects language itself and typically affects writing as well.',
    },
    {
      q: 'Can someone have more than one of these at the same time?',
      a: 'Yes, and it is common. A stroke damages an area rather than a category, and the regions involved in language, speech planning and the muscles of the mouth sit close together. This is one reason working out the diagnosis from the outside is unreliable.',
    },
    {
      q: 'Does aphasia mean a person has lost their intelligence?',
      a: 'No. Aphasia affects language, not thinking. The person is as intelligent as they were before. Understanding is also frequently much better preserved than speech, so assume they follow more than they can say.',
    },
  ],
};
