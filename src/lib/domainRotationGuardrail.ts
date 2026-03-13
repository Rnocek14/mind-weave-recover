/**
 * Domain Rotation Guardrail
 * 
 * Ensures all 7 cognitive domains are exercised at least twice weekly.
 * Acts as a soft inclusion rule — does NOT override severe weakness logic.
 * 
 * Returns underexposed domains that should be added to session planning,
 * but only as suggestions (not hard replacements).
 */

import { COGNITIVE_DOMAINS, type DomainSlug, type DomainScore } from './cognitiveStateEngine';

export interface DomainExposure {
  domainSlug: DomainSlug;
  label: string;
  trialCount7d: number;
  sessionCount7d: number;
  isUnderexposed: boolean;
}

export interface RotationGuardrailResult {
  underexposedDomains: DomainSlug[];
  exposureMap: DomainExposure[];
  reasoning: string[];
}

/** Minimum sessions per domain per week to avoid underexposure */
const MIN_WEEKLY_SESSIONS = 2;

/** Minimum total trials before guardrail activates (avoid early noise) */
const MIN_TOTAL_TRIALS_TO_ACTIVATE = 30;

/**
 * Analyze domain exposure from recent trial data and return underexposed domains.
 * 
 * @param recentTrialsByDomain - Map of domain slug to trial count in last 7 days
 * @param recentSessionsByDomain - Map of domain slug to unique session count in last 7 days
 * @param totalTrials7d - Total trials across all domains in last 7 days
 * @param domainScores - Current domain scores (to avoid overriding severe weakness targeting)
 */
export function getUnderexposedDomains(
  recentTrialsByDomain: Map<string, number>,
  recentSessionsByDomain: Map<string, number>,
  totalTrials7d: number,
  domainScores?: DomainScore[]
): RotationGuardrailResult {
  const reasoning: string[] = [];
  
  // Don't activate until enough data exists
  if (totalTrials7d < MIN_TOTAL_TRIALS_TO_ACTIVATE) {
    reasoning.push(`Only ${totalTrials7d} trials in 7d (need ${MIN_TOTAL_TRIALS_TO_ACTIVATE}) — guardrail inactive`);
    return {
      underexposedDomains: [],
      exposureMap: buildExposureMap(recentTrialsByDomain, recentSessionsByDomain),
      reasoning,
    };
  }
  
  const exposureMap = buildExposureMap(recentTrialsByDomain, recentSessionsByDomain);
  const underexposed: DomainSlug[] = [];
  
  for (const exposure of exposureMap) {
    // Skip cognitive_endurance — it's computed across all exercises, not a targetable domain
    if (exposure.domainSlug === 'cognitive_endurance') continue;
    
    if (exposure.sessionCount7d < MIN_WEEKLY_SESSIONS) {
      // Check if this domain has a severe weakness — if so, don't flag as underexposed
      // because the weakness rules will already be prioritizing it
      const domainScore = domainScores?.find(d => d.domainSlug === exposure.domainSlug);
      const isSeverelyWeak = domainScore && domainScore.confidence !== 'low' && domainScore.score < 0.35;
      
      if (!isSeverelyWeak) {
        underexposed.push(exposure.domainSlug);
        reasoning.push(
          `${exposure.label}: only ${exposure.sessionCount7d} sessions in 7d (min: ${MIN_WEEKLY_SESSIONS})`
        );
      }
    }
  }
  
  if (underexposed.length === 0) {
    reasoning.push('All domains have adequate weekly exposure');
  }
  
  return { underexposedDomains: underexposed, exposureMap, reasoning };
}

function buildExposureMap(
  trialsByDomain: Map<string, number>,
  sessionsByDomain: Map<string, number>
): DomainExposure[] {
  return COGNITIVE_DOMAINS.map(domain => {
    const trialCount7d = trialsByDomain.get(domain.slug) ?? 0;
    const sessionCount7d = sessionsByDomain.get(domain.slug) ?? 0;
    return {
      domainSlug: domain.slug,
      label: domain.label,
      trialCount7d,
      sessionCount7d,
      isUnderexposed: domain.slug !== 'cognitive_endurance' && sessionCount7d < MIN_WEEKLY_SESSIONS,
    };
  });
}
