import type { Guide } from './types';

export const guide: Guide = {
  slug: 'word-finding-difficulty-after-stroke',
  title: 'Why Can\'t They Find the Word? Anomia After a Stroke',
  h1: "Why can't they find the word?",
  description:
    'What word-finding difficulty after a stroke actually is, why the word is usually still there, and what the specific behaviors — wrong words, talking around it — really mean.',
  updated: '2026-08-19',
  intent: 'symptom',
  standfirst:
    'You can see they know it. It is right there. Here is what is actually happening in that pause.',
  related: [
    '/guides/helping-someone-find-a-word',
    '/guides/aphasia-apraxia-dysarthria',
    '/free-aphasia-games',
  ],
  body: `
The look is unmistakable. They start a sentence, get most of the way through,
and stop — and their face says they know exactly what the missing word is and
cannot get to it.

That's word-finding difficulty. The clinical name is anomia, and it's the most
common language symptom after a stroke by a wide margin. Almost everyone with
aphasia has some of it, and many people have it as the main thing left once
other difficulties have improved.

The most important thing to understand about it is the thing your instincts
already told you: **the word is usually still there.** What's damaged isn't the
storage, it's the retrieval.

## It's the same thing you already experience

You know the feeling where a name is on the tip of your tongue? You know the
person, you know the film they were in, you know the first letter, and the name
will not come — and then it arrives forty minutes later while you're doing
something else.

That's the same mechanism. The word was never gone. The route to it failed
temporarily.

Anomia after a stroke is that, permanently amplified. Not a different
experience, a much more frequent one. This is worth knowing because it changes
how you treat it. Nobody quizzes you when you can't remember an actor's name.
Nobody speaks slowly to you or looks worried. They wait, or they help, and
then everyone moves on.

## What you'll actually see

**Long pauses mid-sentence.** The sentence starts confidently and stalls at
one specific word — usually a noun, often the most important word in the
sentence.

**A different word arriving instead.** Sometimes related — "fork" for "knife",
"dog" for "cat". Sometimes it sounds similar — "table" for "cable". Sometimes
it's nothing like either, which is the most disconcerting version. These
substitutions are informative to a clinician, which is one reason it's worth
mentioning to them which kind you're hearing.

**Talking around it.** "The thing you use for the… for the food, the hot
thing." This is not failure. It's a workaround, it's effective, and it's worth
encouraging rather than correcting.

**Empty words.** "Thing", "stuff", "that one", "you know". A conversation can
become mostly these while sounding structurally fine.

**Getting it after the moment passes.** The word arrives thirty seconds later,
once the pressure is off, which can be its own frustration.

**Better on some days than others.** Fatigue, stress, illness, noise, being
put on the spot — all of it moves the difficulty around, sometimes
dramatically. A bad afternoon is not a relapse.

## Why familiar words can be harder than obscure ones

This one surprises everybody. A person may reach a fairly unusual word and get
stuck on the name of their own street.

Which words come easily doesn't track how common or simple a word is in any
way you'd expect. It's affected by how often the person used the word, how
concrete it is, how many similar-sounding words compete with it, and things
nobody can predict from the outside. Names of people and places are frequently
among the hardest, which is cruel given how often they come up.

So don't read anything into which words go missing. It isn't a measure of how
much they know, and it isn't emotional — the name of their own daughter going
missing is not a statement about their daughter.

## What helps in the moment

Briefly, since there's a fuller version in
[how to help someone find a word](/guides/helping-someone-find-a-word):

- **Wait.** Ten seconds, which will feel like a minute.
- **Then narrow it,** not solve it — the category, then what it's for, then the
  first sound, then a choice of two.
- **Then say it warmly and move on** if it isn't coming.
- **Cut the noise.** A television in the room measurably raises the difficulty
  of every exchange.
- **Don't quiz.** "What's this called? And this?" turns a conversation into an
  exam.

And take the workaround as a win. If they got the idea across by describing it,
the communication succeeded — which is the actual goal, and a much more useful
target than the specific word.

## Is it going to get better?

That's a question for a clinician who has assessed the person, and any answer
from a web page — including this one — is worth very little. Recovery varies
enormously between people and depends on things nobody can see from outside.

What can be said generally: word finding is one of the areas that practice is
most often aimed at, precisely because retrieval is a route that gets used, and
routes that get used tend to be easier to use. That's the reasoning behind most
home practice programs, and it's why nearly everything on this site targets
retrieval specifically.

Ask the speech-language pathologist what a realistic few months looks like for
this person. Their answer will be worth more than any general one.

## When it's not only anomia

If speech sounds slurred rather than searching, or the same word comes out
differently every attempt, something else may be going on alongside — see
[aphasia, apraxia, dysarthria](/guides/aphasia-apraxia-dysarthria) for what
those look like. People frequently have more than one at the same time, which
is another reason working it out from the outside is unreliable.

And if word-finding trouble is **new** — appearing suddenly in someone who was
fine — that is a reason to contact a doctor now, not to read about it.

## Practicing it

Retrieval practice is what almost every exercise on this site is. The
[free games](/free-aphasia-games) run about two minutes each with no account,
and the [printable pack](/free-aphasia-worksheets) does the same on paper.

The thing they both do that a worksheet from the internet usually doesn't:
credit the reach. A different sensible answer, a description instead of a name,
or the right word said imperfectly all count — because in a real conversation,
they do.
`.trim(),
  faq: [
    {
      q: 'What is anomia?',
      a: 'Anomia is difficulty retrieving words — the most common language symptom after a stroke. The word is usually still stored; what is damaged is the route to it. It is the same mechanism as a name being on the tip of your tongue, amplified and much more frequent.',
    },
    {
      q: 'Why do they say the wrong word instead?',
      a: 'Substitutions are typical of word-finding difficulty. The replacement is often related in meaning ("fork" for "knife") or in sound ("table" for "cable"), and sometimes neither. Which kind you hear is useful information for a speech-language pathologist, so it is worth mentioning.',
    },
    {
      q: 'Why can they say a hard word but not a simple one?',
      a: 'Which words come easily does not track how common or simple a word is. It is affected by how often the person used it, how concrete it is, and how many similar words compete with it. Names of people and places are frequently among the hardest, and none of it reflects how much the person knows or cares.',
    },
    {
      q: 'Should I let them describe a word instead of saying it?',
      a: 'Yes. Talking around a missing word is an effective workaround, not a failure, and it transfers directly to real conversation where nobody gets to stop when a word will not come. Encouraging it is more useful than correcting it.',
    },
  ],
};
