# API Cost Optimization Ideas

## 1. Embedding Cache (OpenAI)
- Our word/phrase bank is finite — pre-compute and store all embeddings in a Supabase table
- On lookup, check DB first; only call OpenAI for genuinely new words
- Eliminates ~95% of embedding API calls

## 2. TTS Audio Cache (ElevenLabs)
- Store generated audio files in Supabase Storage keyed by text + voice
- Serve cached audio on repeat plays
- Phrases repeat across sessions — huge savings

## 3. Switch to String-Based Similarity
- Use Levenshtein distance / n-gram overlap instead of embeddings for phrase matching
- Already have a rule-based fallback in semanticSimilarity.ts
- Trade-off: less semantic nuance, but sufficient for speech practice

## 4. Conditional Pronunciation Analysis
- Only run Azure/Whisper if initial string match is below threshold (e.g., <70%)
- Skip expensive analysis when the user clearly got it right

## 5. Batch Embedding Requests
- Collect multiple words per API call instead of one-at-a-time
- OpenAI embeddings API supports batch input

## 6. Rate Limiting / Budget Caps
- Add a daily API call counter in Supabase
- Gracefully degrade to fallback when budget is reached
- Prevents surprise billing spikes
