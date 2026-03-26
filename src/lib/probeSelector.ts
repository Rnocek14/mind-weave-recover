/**
 * Profile-Driven Probe Selector
 * 
 * Makes Maya choose tasks like a therapist:
 * - Based on profile + trends + live signals
 * - Not just the last utterance
 * 
 * Inputs: speech profile, MayaState, recent results, speech analysis, phase, fatigue
 * Output: next best action (stay conversational, probe lightly, or launch structured task)
 */

import type { ClinicalProfile } from './clinicalProfileMapper';
import type { MayaState } from './buildMayaState';
import type { NormalizedExerciseResult } from './normalizedExerciseResult';
import type { SpeechAnalysisForOrchestrator, SessionPhase, PopupReason } from './coachOrchestrator';

// ── Types ──

export type FatigueState = 'fresh' | 'mild' | 'high';

export type ProbeDecision =
  | { action: 'stay_conversational'; reason: string }
  | { action: 'chat_probe'; probeType: 'word_finding' | 'sentence_length' | 'comprehension' | 'fluency'; reason: string }
  | { action: 'launch_exercise'; slug: string; reason: PopupReason; targetDomain: string; difficultyHint: 'easier' | 'same' | 'harder'; reason_detail: string };

export interface ProbeSelectionInput {
  profile: ClinicalProfile | null;
  mayaState: MayaState | null;
  recentResults: NormalizedExerciseResult[];
  speechAnalysis: SpeechAnalysisForOrchestrator | null;
  sessionPhase: SessionPhase;
  fatigueState: FatigueState;
  popupCount: number;
  recentPopupSlugs: string[];
  turnNumber: number;
}

// ── Domain Mapping ──

interface DomainTarget {
  domain: string;
  label: string;
  exerciseSlugs: string[];
  chatProbeType: 'word_finding' | 'sentence_length' | 'comprehension' | 'fluency';
}

const DOMAIN_TARGETS: DomainTarget[] = [
  {
    domain: 'expressive_language',
    label: 'Word Finding',
    exerciseSlugs: ['photo-naming', 'semantic-features'],
    chatProbeType: 'word_finding',
  },
  {
    domain: 'semantic_processing',
    label: 'Semantic Processing',
    exerciseSlugs: ['semantic-features', 'meaning-match'],
    chatProbeType: 'word_finding',
  },
  {
    domain: 'sentence_production',
    label: 'Sentence Building',
    exerciseSlugs: ['sentence-construction'],
    chatProbeType: 'sentence_length',
  },
  {
    domain: 'phonology',
    label: 'Sound Discrimination',
    exerciseSlugs: ['minimal-pairs'],
    chatProbeType: 'fluency',
  },
  {
    domain: 'comprehension',
    label: 'Understanding',
    exerciseSlugs: ['meaning-match', 'yes-no-comprehension'],
    chatProbeType: 'comprehension',
  },
  {
    domain: 'discourse',
    label: 'Connected Speech',
    exerciseSlugs: ['story-retell'],
    chatProbeType: 'fluency',
  },
];

// ── Profile Analysis ──

function getWeakDomains(profile: ClinicalProfile | null, mayaState: MayaState | null): string[] {
  const weak: string[] = [];

  if (profile) {
    const speechImps = profile.impairments.speech.map(s => s.toLowerCase());
    
    if (speechImps.some(s => s.includes('expressive') || s.includes('anomic') || s.includes('word finding') || s.includes('naming'))) {
      weak.push('expressive_language');
    }
    if (speechImps.some(s => s.includes('receptive') || s.includes('comprehension') || s.includes('understanding'))) {
      weak.push('comprehension');
    }
    if (speechImps.some(s => s.includes('non-fluent') || s.includes('broca') || s.includes('agrammat'))) {
      weak.push('sentence_production');
    }
    if (speechImps.some(s => s.includes('phonolog') || s.includes('phonemic'))) {
      weak.push('phonology');
    }
    if (speechImps.some(s => s.includes('semantic') || s.includes('wernicke'))) {
      weak.push('semantic_processing');
    }
    if (speechImps.some(s => s.includes('discourse') || s.includes('narrative'))) {
      weak.push('discourse');
    }
  }

  // Enrich from MayaState struggles
  if (mayaState?.memory.recentStruggles.length) {
    for (const struggle of mayaState.memory.recentStruggles) {
      const s = struggle.toLowerCase();
      if (s.includes('word') || s.includes('naming')) weak.push('expressive_language');
      if (s.includes('sentence') || s.includes('grammar')) weak.push('sentence_production');
      if (s.includes('understand') || s.includes('comprehension')) weak.push('comprehension');
      if (s.includes('sound') || s.includes('phonol')) weak.push('phonology');
    }
  }

  // Deduplicate
  return [...new Set(weak)];
}

function getLiveDomainSignals(speech: SpeechAnalysisForOrchestrator | null): string[] {
  if (!speech) return [];
  const signals: string[] = [];

  if (speech.circumlocutionDetected) signals.push('expressive_language');
  if (speech.effortfulSpeech && speech.wordCount < 4) signals.push('sentence_production');
  if (speech.pausePattern === 'very_slow') signals.push('expressive_language');
  if (speech.filledPauseCount >= 3) signals.push('expressive_language');

  return signals;
}

// ── Scoring ──

interface ScoredDomain {
  domain: DomainTarget;
  score: number; // higher = more urgent
}

function scoreDomains(
  input: ProbeSelectionInput,
  weakDomains: string[],
  liveSignals: string[]
): ScoredDomain[] {
  return DOMAIN_TARGETS.map(domain => {
    let score = 0;

    // Profile weakness: +5
    if (weakDomains.includes(domain.domain)) score += 5;

    // Live signal: +3
    if (liveSignals.includes(domain.domain)) score += 3;

    // MayaState thread alignment: +2
    if (input.mayaState?.thread.primaryDomainSlug === domain.domain) score += 2;

    // Recent results: penalize if recently tested (variety)
    const recentlySlugs = input.recentResults.map(r => r.slug);
    const hasRecent = domain.exerciseSlugs.some(s => recentlySlugs.includes(s));
    if (hasRecent) score -= 2;

    // Penalize if popup was same slug recently
    const recentPopupOverlap = domain.exerciseSlugs.some(s => input.recentPopupSlugs.includes(s));
    if (recentPopupOverlap) score -= 3;

    // Recent poor performance in this domain: +2
    const domainResults = input.recentResults.filter(r => 
      domain.exerciseSlugs.includes(r.slug)
    );
    if (domainResults.some(r => r.successBand === 'low')) score += 2;

    return { domain, score };
  }).sort((a, b) => b.score - a.score);
}

// ── Main Selector ──

const MAX_POPUPS = 3;
const MODAL_CAPABLE_SLUGS = [
  'photo-naming', 'minimal-pairs', 'meaning-match',
  'semantic-features', 'sentence-construction',
  'yes-no-comprehension', 'story-retell',
];

export function selectNextProbe(input: ProbeSelectionInput): ProbeDecision {
  const { sessionPhase, fatigueState, popupCount, turnNumber, speechAnalysis } = input;

  // Phase guards
  if (sessionPhase === 'warmup' && turnNumber < 3) {
    return { action: 'stay_conversational', reason: 'Still in warmup — building rapport' };
  }
  if (sessionPhase === 'wrapup') {
    return { action: 'stay_conversational', reason: 'Wrapping up session' };
  }

  // Fatigue guard — only light probes or conversational
  if (fatigueState === 'high') {
    return {
      action: 'chat_probe',
      probeType: 'comprehension',
      reason: 'High fatigue — staying light with comprehension check',
    };
  }

  // Score domains
  const weakDomains = getWeakDomains(input.profile, input.mayaState);
  const liveSignals = getLiveDomainSignals(speechAnalysis);
  const scored = scoreDomains(input, weakDomains, liveSignals);

  // No clear target → stay conversational and observe
  if (scored.length === 0 || scored[0].score <= 0) {
    return { action: 'stay_conversational', reason: 'No strong domain signal — observing' };
  }

  const topDomain = scored[0].domain;

  // Decide: chat probe vs structured exercise
  // Use structured exercise if: profile weakness + popup budget + not fatigued
  const notFatigued = fatigueState === 'fresh';
  const mildlyTired = fatigueState === 'mild';
  const shouldPopup =
    popupCount < MAX_POPUPS &&
    scored[0].score >= 5 && // strong signal
    (notFatigued || mildlyTired) &&
    turnNumber >= 4; // give conversation time first

  if (shouldPopup) {
    // Pick best slug not recently used
    const availableSlug = topDomain.exerciseSlugs.find(
      s => MODAL_CAPABLE_SLUGS.includes(s) && !input.recentPopupSlugs.includes(s)
    );

    if (availableSlug) {
      // Difficulty hint from recent results
      const recentInDomain = input.recentResults.find(r => r.slug === availableSlug);
      let difficultyHint: 'easier' | 'same' | 'harder' = 'same';
      if (recentInDomain) {
        if (recentInDomain.successBand === 'low') difficultyHint = 'easier';
        else if (recentInDomain.successBand === 'high') difficultyHint = 'harder';
      }
      if (mildlyTired) difficultyHint = 'easier';

      return {
        action: 'launch_exercise',
        slug: availableSlug,
        reason: scored[0].score >= 8 ? 'repeated_struggle' : 'targeted_probe',
        targetDomain: topDomain.domain,
        difficultyHint,
        reason_detail: `Profile weakness in ${topDomain.label}${liveSignals.includes(topDomain.domain) ? ' + live speech signal' : ''}`,
      };
    }
  }

  // Fallback: chat-based probe
  return {
    action: 'chat_probe',
    probeType: topDomain.chatProbeType,
    reason: `Targeting ${topDomain.label} via conversation`,
  };
}
