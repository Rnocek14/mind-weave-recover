/**
 * Spoken choices for Detective Mind. Both automatic narration and the
 * "Repeat question" button must explicitly announce each displayed label.
 * Bare "C. ..." gets swallowed by some TTS normalizers, especially for the
 * final option, which makes the spoken list disagree with the visual choices.
 *
 * This produces the exact same text as the earlier inline mapping.
 */
export function formatDetectiveOptionsForSpeech(displayedOptions: readonly string[]): string {
  return displayedOptions
    .map((option, index) => `Option ${String.fromCharCode(65 + index)}: ${option}`)
    .join('. ');
}
