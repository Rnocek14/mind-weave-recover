/**
 * Recent practice exposure passed to TodayFocus. This is ACTIVITY volume,
 * not clinical proficiency: a noisy or unscored attempt may still document
 * that a patient attempted a game, but does not count as a correct response.
 */
import { COGNITIVE_DOMAINS } from "./cognitiveStateEngine";
import { toLessonExerciseSlug } from "./exerciseSlugNormalizer";
import type { DomainExposure7d } from "./adaptiveDecisionEngine";

export interface RecentDomainEvent {
  exercise_slug: string | null;
  session_id: string | null;
  created_at: string | null;
}

export function buildDomainExposure7d(
  events: readonly RecentDomainEvent[],
  windowStartIso: string,
): DomainExposure7d[] {
  const start = Date.parse(windowStartIso);
  if (!Number.isFinite(start)) return [];
  const recent = events.flatMap(event => {
    const timestamp = Date.parse(event.created_at ?? "");
    if (!event.exercise_slug || !Number.isFinite(timestamp) || timestamp < start) return [];
    return [{
      ...event,
      lessonSlug: toLessonExerciseSlug(event.exercise_slug),
    }];
  });

  return COGNITIVE_DOMAINS.filter(domain => domain.exerciseSlugs.length > 0).map(domain => {
    const domainTrials = recent.filter(event =>
      (domain.exerciseSlugs as readonly string[]).includes(event.lessonSlug));
    const uniqueSessions = new Set(domainTrials.map(event => event.session_id).filter(Boolean));
    return {
      domainSlug: domain.slug,
      trialCount: domainTrials.length,
      sessionCount: uniqueSessions.size,
    };
  });
}
