/**
 * Performance-Aware Feedback Engine
 * 
 * CRITICAL RULE: Never celebrate low performance.
 * Stroke patients already feel frustration and loss — misleading feedback
 * destroys clinical trust instantly.
 */

export type FeedbackTone = 'celebrate' | 'encourage' | 'support' | 'protect';

export function getFeedbackTone(accuracy: number): FeedbackTone {
  if (accuracy >= 85) return 'celebrate';
  if (accuracy >= 60) return 'encourage';
  if (accuracy >= 40) return 'support';
  return 'protect';
}

/** Session summary headline — performance-aware */
export function getSessionHeadline(avgScore: number | null): { text: string; emoji: string } {
  if (avgScore === null) return { text: "Session complete!", emoji: "✅" };
  const tone = getFeedbackTone(avgScore);
  switch (tone) {
    case 'celebrate':
      return { text: "Amazing work!", emoji: "🌟" };
    case 'encourage':
      return { text: "Great effort!", emoji: "💪" };
    case 'support':
      return { text: "Good practice!", emoji: "👍" };
    case 'protect':
      return { text: "You showed up — that matters!", emoji: "❤️" };
  }
}

/** Post-session card headline — performance-aware, NEVER celebrates low scores */
export function getPostSessionHeadline(feedback: {
  accuracy: number;
  correctDelta: number;
  streak: number;
  independentCorrect: number;
}): { text: string; emoji: string } {
  const { accuracy, correctDelta, streak, independentCorrect } = feedback;
  const tone = getFeedbackTone(accuracy);

  // High performance — safe to celebrate
  if (tone === 'celebrate') {
    if (independentCorrect >= 5) return { text: "So many on your own!", emoji: "⭐" };
    return { text: "Amazing work!", emoji: "🎉" };
  }

  // Good performance — encourage
  if (tone === 'encourage') {
    if (correctDelta > 0) return { text: "You're improving!", emoji: "📈" };
    return { text: "Great session!", emoji: "💪" };
  }

  // Moderate — support without false celebration
  if (tone === 'support') {
    if (correctDelta > 0) return { text: "You're making progress!", emoji: "📈" };
    return { text: "Good practice today!", emoji: "👍" };
  }

  // Low performance — protect dignity, acknowledge effort
  // NEVER use streak fire emoji or "consistency pays off" here
  if (streak >= 3) return { text: "Showing up matters — proud of you!", emoji: "💛" };
  return { text: "You showed up — that matters!", emoji: "💛" };
}

/** Post-session motivational nudge — performance-aware */
export function getPostSessionNudge(
  feedback: { streak: number; correctDelta: number; independentCorrect: number; accuracy: number },
  domainLabel: string | null
): string {
  const tone = getFeedbackTone(feedback.accuracy);

  // Only use high-energy language for high performance
  if (tone === 'celebrate' || tone === 'encourage') {
    if (feedback.independentCorrect >= 3 && domainLabel) {
      return `${feedback.independentCorrect} answers without any help in ${domainLabel} — that's real progress! 🌟`;
    }
    if (feedback.streak >= 5) return `${feedback.streak} days in a row — you're building a powerful habit!`;
    if (feedback.streak >= 3) return `${feedback.streak} days in a row — keep the momentum going!`;
    if (feedback.correctDelta > 0) return `${feedback.correctDelta} more correct than last time — you're getting stronger! 📈`;
    if (domainLabel) return `Strong work on ${domainLabel} today!`;
    return "Every session builds stronger connections 🧠";
  }

  // Support / protect — gentle, no false excitement
  if (tone === 'support') {
    if (feedback.correctDelta > 0) return "You improved from last time — that's what matters 📈";
    if (feedback.streak >= 2) return `${feedback.streak} days practicing — that takes real commitment`;
    return "Every bit of practice helps your brain build new paths 🧠";
  }

  // Protect
  if (feedback.streak >= 2) return `${feedback.streak} days showing up — that takes courage 💛`;
  return "Some days are harder than others — you're still moving forward 💛";
}

/** Transition encouragement — context-aware, not blindly celebratory */
export function getTransitionEncouragement(): { text: string; emoji: string } {
  // These are safe because they're between exercises, not scoring
  const options = [
    { text: "Nice work!", emoji: "💪" },
    { text: "Moving on!", emoji: "✨" },
    { text: "Let's keep going!", emoji: "🎯" },
    { text: "Good effort!", emoji: "👍" },
    { text: "Next one!", emoji: "➡️" },
  ];
  return options[Math.floor(Math.random() * options.length)];
}

/** Human-friendly domain labels — replaces raw slugs everywhere */
export const DOMAIN_DISPLAY_LABELS: Record<string, string> = {
  // Domain slugs
  lexical_retrieval: "Word finding",
  semantic_depth: "Meaning & categories",
  executive_function: "Thinking & planning",
  syntax: "Sentence building",
  phonology: "Sounds & pronunciation",
  discourse_organization: "Conversation",
  discourse: "Conversation",
  motor: "Movement",
  visual_spatial: "Visual skills",
  visuospatial: "Visual attention",
  // Short clinical terms used in analytics
  phonological: "Sounds",
  semantic: "Meaning",
  grammar: "Grammar",
  // Exercise slugs (for summary screens)
  'picture-naming': "Picture Naming",
  'photo-naming': "Photo Naming",
  'minimal-pairs': "Minimal Pairs",
  'two-clues': "Two Clues",
  'yes-no-questions': "Yes/No Questions",
  'category-fluency': "Category Fluency",
  'sentence-construction': "Sentence Building",
  'fix-sentence': "Fix the Sentence",
  'story-retell': "Story Retell",
  'dual-load-naming': "Dual Load Naming",
  'conversation-coach': "Conversation Practice",
  'phonological-awareness': "Sound Awareness",
  'follow-directions': "Follow Directions",
  'sequence-builder': "Sequence Builder",
  'semantic-features': "Semantic Features",
  'word-finding': "Word Finding",
};

/** Convert any slug to a human-friendly label */
export function humanizeSlug(slug: string): string {
  // Check direct lookup first
  const direct = DOMAIN_DISPLAY_LABELS[slug];
  if (direct) return direct;
  // Also try with dashes
  const dashed = slug.replace(/_/g, '-');
  const dashedLabel = DOMAIN_DISPLAY_LABELS[dashed];
  if (dashedLabel) return dashedLabel;
  // Fallback: title case the slug
  return slug
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
