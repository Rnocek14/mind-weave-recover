

# Unified Voice: Make Maya Sound Like One Person Throughout

## The Problem

Right now there are **three different TTS paths** in the system:

1. **Maya's conversation** → `speakStream()` → ElevenLabs streaming endpoint → Matilda voice (natural)
2. **Card game instructions** (TwoClues reading clues, MinimalPairs playing words, etc.) → `speak()` → different ElevenLabs endpoint → falls back to **browser robot voice** on any failure
3. **StoryRetellProbe** → `window.speechSynthesis.speak()` directly → always browser robot voice

When a card pops up mid-conversation, the voice literally changes from ElevenLabs Matilda to the browser's built-in robotic voice. That breaks immersion completely.

## What Changes

### 1. Unify all TTS onto one path: `speakStream()` (ElevenLabs streaming)

**`src/hooks/useTextToSpeech.ts`**
- Rewrite `speak()` to internally call `speakStream()` instead of hitting a separate endpoint
- This means every component that calls `speak(text)` automatically gets Matilda's ElevenLabs voice
- Keep `speakBrowser()` as emergency-only fallback (network down), not the primary fallback
- Remove the separate `text-to-speech-elevenlabs` fetch path

### 2. Fix StoryRetellProbe to use Maya's voice

**`src/components/coach/StoryRetellProbe.tsx`**
- Replace `window.speechSynthesis.speak()` with the shared `speak()` from `useTextToSpeech`
- Pass `speak` as a prop from the parent, or import the hook directly
- This makes the story narration sound like Maya reading the story, not a robot

### 3. Ensure consistent voice ID everywhere

- All paths use Matilda (`XrExE9yKIg1WjnnlVkGX`) as default
- Remove the `EXAVITQu4vr4xnSDxMaL` (Sarah) voice ID used in `ConversationPartnerGame.tsx` — or make it configurable from one constant
- Create a single `MAYA_VOICE_ID` constant so voice is controlled from one place

### 4. Make card transitions seamless in the conversation flow

**`src/hooks/useCoachSession.ts`** (card intro/outro text)
- Review how card intro text is generated — Maya should say things like "Let me show you something — look at this picture and tell me what you see" rather than a generic system prompt
- Ensure the intro text is spoken by `speakStream()` (same Maya voice) before card UI appears
- Ensure the outro text after card completion uses the same voice

## Technical Details

**Files to modify:**
- `src/hooks/useTextToSpeech.ts` — Consolidate `speak()` to use streaming path
- `src/components/coach/StoryRetellProbe.tsx` — Replace `window.speechSynthesis` with hook
- `src/components/ConversationPartnerGame.tsx` — Use `MAYA_VOICE_ID` constant
- Add `src/lib/constants/voice.ts` — Single `MAYA_VOICE_ID` constant

**What stays the same:**
- Input architecture (unified mode system)
- Card timing and flow engine logic
- Speech recognition pipeline
- All game scoring/completion logic

## Expected Result

Before: Voice noticeably changes when a card appears — sounds like two different systems
After: Maya's voice stays consistent throughout — conversation, game instructions, story narration, feedback — all sound like the same person talking to you

