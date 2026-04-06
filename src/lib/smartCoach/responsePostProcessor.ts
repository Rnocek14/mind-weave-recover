/**
 * Smart Coach — Response Post-Processor
 * 
 * Final cleanup before the user sees/hears the line.
 */

export function postProcessCoachLine(line: string): string {
  let result = line
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove repeated punctuation
    .replace(/\.{2,}/g, '.')
    .replace(/\?{2,}/g, '?')
    .replace(/!{2,}/g, '!')
    // Remove quotes wrapping the whole line (LLM artifact)
    .replace(/^["'](.+)["']$/, '$1')
    // Remove "Maya:" prefix (LLM artifact)
    .replace(/^maya:\s*/i, '')
    // Remove "Coach:" prefix
    .replace(/^coach:\s*/i, '')
    .trim();

  // Tiered length protection:
  // 0–30 words: allow as-is
  // 31–40 words: allow, log warning
  // 41+ words: emergency trim at last sentence boundary
  const words = result.split(/\s+/);
  if (words.length > 40) {
    const truncated = words.slice(0, 38).join(' ');
    const lastPunct = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('?'),
      truncated.lastIndexOf('!')
    );
    result = lastPunct > 10
      ? truncated.slice(0, lastPunct + 1)
      : truncated + '?';
    console.warn(`[PostProcessor] Emergency trim: ${words.length} words → ${result.split(/\s+/).length}`);
  } else if (words.length > 30) {
    console.warn(`[PostProcessor] Long response (${words.length} words), allowing through`);
  }

  return result;
}
