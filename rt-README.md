# Runtime verification harness (temporary — not part of the app)

Drives the REAL production bundle in a REAL browser against the REAL backend.

Why it exists: for the whole of this session I could only say "the logic is
tested", never "it works in a session". This closes that.

Two accommodations, both of which leave the code under test untouched:

1. Chromium in this sandbox has no usable certificate root store — example.com
   fails exactly like neurospark.co does, with and without the agent proxy. So
   `rt-server.mjs` puts Node in front: it serves `dist/` over plain HTTP on
   127.0.0.1:8899 and forwards Supabase calls over real HTTPS. TLS verification
   is never switched off anywhere. `dist/` was verified byte-identical to the
   live site — all 89 chunks plus the entry bundle.
2. Headless Chromium has no Web Speech API, so `rt-harness.mjs` installs a
   controllable stand-in before any app code runs. It stands in for the
   ENGINE only: every hook, timer, threshold and gate exercised is the real
   shipped code reacting to real recognition events.

## Running

    node rt-server.mjs &            # serves dist/ on 127.0.0.1:8899
    RT_EMAIL=... node <script>.mjs

`rt-harness.mjs` exports `launch`, `newPage`, `newBag`, `createAccount`,
`openExercise`, `ORIGIN`.

Inside the page, `window.__sr` drives recognition:

    window.__sr.say('you drink coffee out of it', true)   // final result
    window.__sr.say('you drink', false)                   // interim
    window.__sr.active()                                  // live recogniser or null
    window.__sr.log                                       // start/stop/say history

## Test accounts

Every account this harness creates is named `neurospark-rt-*@mailinator.com`.
They are throwaway and safe to delete; see the cleanup SQL in the session
notes.
