import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeakerIntegrityPanel } from './SpeakerIntegrityPanel';

const api = vi.hoisted(() => ({
  getSpeakerEnrollmentStatus: vi.fn(),
  getSpeakerChecks: vi.fn(),
  pollSpeakerEnrollment: vi.fn(),
  pollSpeakerCheck: vi.fn(),
  enrollSpeakerSample: vi.fn(),
  revokeSpeakerEnrollment: vi.fn(),
  getSpeakerReviewAudio: vi.fn(),
  saveSpeakerReview: vi.fn(),
}));

vi.mock('@/lib/speech/speakerIntegrityClient', () => api);
vi.mock('@/hooks/useAudioRecorder', async () => {
  const { useCallback, useState } = await import('react');
  return {
    useAudioRecorder: () => {
      const [isRecording, setIsRecording] = useState(false);
      const startRecording = useCallback(async () => {
        setIsRecording(true);
        return true;
      }, []);
      const stopRecording = useCallback(async () => {
        setIsRecording(false);
        return {
          audioBlob: new Blob(['synthetic local bytes only'], { type: 'audio/webm' }),
          duration: 8000,
          mimeType: 'audio/webm',
        };
      }, []);
      const cancelRecording = useCallback(() => setIsRecording(false), []);
      return { isRecording, startRecording, stopRecording, cancelRecording };
    },
  };
});

const testPatient = '22222222-2222-4222-8222-222222222222';
const createObjectURL = URL.createObjectURL;
const revokeObjectURL = URL.revokeObjectURL;

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  api.getSpeakerEnrollmentStatus.mockResolvedValue({ enabled: true, status: 'not_enrolled' });
  api.enrollSpeakerSample.mockResolvedValue({ status: 'pending' });
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true, value: vi.fn(() => 'blob:synthetic-local-voice-only'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true, value: vi.fn(),
  });
});
afterEach(() => {
  cleanup();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
});

async function recordSample() {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Record voice sample' })).toBeEnabled());
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Record voice sample' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Stop voice sample' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Stop voice sample' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm patient-only voice and enroll' })).toBeEnabled());
}

describe('SpeakerIntegrityPanel: enrollment identity confirmation', () => {
  it('keeps enrollment audio local until the owner listens and confirms', async () => {
    render(<SpeakerIntegrityPanel profileId={testPatient} />);
    await recordSample();
    expect(api.enrollSpeakerSample).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Review local enrollment voice sample')).toHaveAttribute(
      'src', 'blob:synthetic-local-voice-only',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Discard and rerecord' }));
    expect(api.enrollSpeakerSample).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Confirm patient-only voice and enroll' })).not.toBeInTheDocument();
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic-local-voice-only'));
  });

  it('sends a sample only after the second explicit patient-only confirmation', async () => {
    render(<SpeakerIntegrityPanel profileId={testPatient} />);
    await recordSample();
    expect(api.enrollSpeakerSample).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm patient-only voice and enroll' }));
    await waitFor(() => expect(api.enrollSpeakerSample).toHaveBeenCalledTimes(1));
    expect(api.enrollSpeakerSample).toHaveBeenCalledWith(
      testPatient, expect.any(Blob), 8000, true,
    );
    expect(api.getSpeakerEnrollmentStatus).toHaveBeenCalledTimes(1);
  });

  it('does not offer enrollment when the server pilot is disabled', async () => {
    api.getSpeakerEnrollmentStatus.mockResolvedValue({ enabled: false, status: 'unavailable' });
    render(<SpeakerIntegrityPanel profileId={testPatient} />);
    await waitFor(() => expect(screen.getByText(/pilot is currently unavailable/i)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Record voice sample' })).not.toBeInTheDocument();
    expect(api.enrollSpeakerSample).not.toHaveBeenCalled();
  });
});
