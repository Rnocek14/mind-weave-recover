import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AxisEvidencePanel } from '@/components/patient-hub/review/AxisEvidencePanel';
import type { TrialData } from '@/hooks/useSessionDetail';

/**
 * Voice Engine v2 Phase 4 — clinician evidence panel.
 *
 * Locks in the spec §9.1 rendering rules:
 *   • the reason line is plain language;
 *   • Communication Success renders its NAMED state, never a decimal;
 *   • the shadow disclosure is always present;
 *   • v1/v2 disagreements are surfaced, not hidden.
 */

const baseTrial: TrialData = {
  attempt_id: 'a1',
  target_word: 'knife',
  transcript: 'the thing you cut with',
  is_correct: false,
  exercise_slug: 'photo_naming',
  latency_ms: 2400,
  error_type: 'circumlocution',
  cue_type_given: null,
  cue_was_effective: null,
  audio_storage_path: null,
  recording_duration_ms: null,
  pronunciation_status: null,
  semantic_similarity: null,
  phonological_similarity: null,
  stuck_type: null,
  speech_rate_wpm: null,
  created_at: '2026-07-10T12:00:00Z',
  axis_scores: {
    wordRetrieval: { value: 0.0, confidence: 0.9, evidence: ['described rather than named'] },
    communicationSuccess: { value: 0.75, confidence: 0.8, evidence: ['gist conveyed'] },
    independence: { value: 1.0, confidence: 0.95, evidence: ['no cue delivered — independent'] },
  },
  strategy_used: 'circumlocution',
  measurement_confidence: 'medium',
  verdict_primary: 'success',
  verdict_reason:
    'Described the target successfully without naming it — communication succeeded, word retrieval did not.',
  shadow_v1_agreement: { v1_correct: false, v2_primary: 'success', agrees: false },
};

describe('AxisEvidencePanel', () => {
  it('renders the plain-language reason line and shadow disclosure', () => {
    render(<AxisEvidencePanel trials={[baseTrial]} />);
    expect(
      screen.getByText(/described the target successfully without naming it/i),
    ).toBeTruthy();
    expect(screen.getByText(/preview — new scoring model/i)).toBeTruthy();
    expect(screen.getByText(/do not affect this session/i)).toBeTruthy();
  });

  it('surfaces v1/v2 disagreements in the disclosure', () => {
    render(<AxisEvidencePanel trials={[baseTrial]} />);
    expect(screen.getByText(/where the two models\s+disagree/i)).toBeTruthy();
  });

  it('shows the NAMED Communication Success state (never the decimal) when expanded', async () => {
    const { container } = render(<AxisEvidencePanel trials={[baseTrial]} />);
    // Expand the attempt row
    fireEvent.click(container.querySelector('button') as HTMLButtonElement);
    expect(await screen.findByText('Gist conveyed, detail missing')).toBeTruthy();
    // The raw axis decimal must not leak into the clinician view.
    expect(screen.queryByText('0.75')).toBeNull();
    // Strategy label is humanized.
    expect(screen.getByText('Circumlocution')).toBeTruthy();
    // Always-on axes carry no "advisory" tag.
    expect(screen.queryByText(/advisory — never gates/i)).toBeNull();
  });

  it('renders the empty state when no attempt has a shadow verdict', () => {
    render(
      <AxisEvidencePanel
        trials={[{ ...baseTrial, verdict_primary: null, axis_scores: null }]}
      />,
    );
    expect(screen.getByText(/no axis-level evidence/i)).toBeTruthy();
  });

  it('derives advisory axes from persisted evidence and tags them advisory (Phase 3)', async () => {
    const withAdvisoryEvidence: TrialData = {
      ...baseTrial,
      gop_data: { pronunciationScore: 74, accuracyScore: 70, fluencyScore: 55 },
      speech_rate_wpm: 42,
      pause_count: 6,
      effortful_speech: true,
      semantic_similarity: 0.4,
    };
    const { container } = render(<AxisEvidencePanel trials={[withAdvisoryEvidence]} />);
    fireEvent.click(container.querySelector('button') as HTMLButtonElement);

    expect(await screen.findByText('Pronunciation')).toBeTruthy();
    expect(screen.getByText('Fluency')).toBeTruthy();
    expect(screen.getByText('Semantic content')).toBeTruthy();
    // Every advisory row carries the never-gates tag.
    expect(screen.getAllByText(/advisory — never gates/i).length).toBe(3);
    // Always-on axes are still present and unpolluted.
    expect(screen.getByText('Gist conveyed, detail missing')).toBeTruthy();
  });

  it('omits advisory rows entirely when their evidence is absent — never faked', async () => {
    const { container } = render(<AxisEvidencePanel trials={[baseTrial]} />);
    fireEvent.click(container.querySelector('button') as HTMLButtonElement);
    await screen.findByText('Gist conveyed, detail missing');
    expect(screen.queryByText('Pronunciation')).toBeNull();
    expect(screen.queryByText('Fluency')).toBeNull();
  });
});
