/** Plain-language labels for generalization-probe error types. */
export function probeErrorLabel(errorType: string | null): string {
  if (!errorType) return "Error";
  const map: Record<string, string> = {
    semantic_paraphasia: "Related-word swap",
    phonemic_paraphasia: "Sound slip",
    neologism: "Made-up word",
    unrelated: "Unrelated word",
    no_response: "No response",
    omission: "Left blank",
    mixed: "Mixed error",
  };
  return map[errorType] ?? errorType.replace(/_/g, " ");
}
