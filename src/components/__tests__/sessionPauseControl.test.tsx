/**
 * SessionPauseControl — pause must actually pause.
 *
 * THE BUG THIS PINS: the overlay came up and Maya kept talking straight
 * through it. `enterPause` called `window.speechSynthesis.cancel()`, which
 * cancels BROWSER speech synthesis — but Maya is ElevenLabs audio playing
 * through an HTML5 <audio> element, which that call cannot touch. Someone who
 * needed a break got a dimmed screen and a voice that carried on.
 *
 * The rest of these tests exist because the fix touches a control that sits
 * on every exercise screen: they pin the behavior that was already working,
 * so silencing the voice cannot quietly cost us the overlay, the resume, or
 * the rule that this button never appears outside an exercise.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SessionPauseControl } from '@/components/SessionPauseControl';
import { voiceController } from '@/lib/voiceController';

const stopAllVoiceMock = vi.fn();
vi.mock('@/lib/voiceControllerStop', () => ({
  stopAllVoice: () => stopAllVoiceMock(),
}));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <SessionPauseControl />
    </MemoryRouter>
  );

beforeEach(() => {
  stopAllVoiceMock.mockClear();
  voiceController.notifySpeakingChanged(false);
});
afterEach(cleanup);

describe('SessionPauseControl — silencing Maya', () => {
  it('stops the real voice pipeline when paused', () => {
    // speechSynthesis.cancel() was never going to stop an <audio> element.
    renderAt('/exercise/fix-sentence');
    fireEvent.click(screen.getByLabelText(/pause session/i));
    expect(stopAllVoiceMock).toHaveBeenCalledTimes(1);
  });

  it('releases the mic lock, so resuming is not stuck behind a phantom speaker', () => {
    // We pause the audio rather than let it end, so its 'ended' handler never
    // fires; without this, voiceController keeps reporting isSpeaking and the
    // mic stays locked after resume until a timeout eventually clears it.
    renderAt('/exercise/fix-sentence');
    voiceController.notifySpeakingChanged(true);
    expect(voiceController.isSpeaking).toBe(true);

    fireEvent.click(screen.getByLabelText(/pause session/i));
    expect(voiceController.isSpeaking).toBe(false);
  });
});

describe('SessionPauseControl — behavior that must survive the fix', () => {
  it('shows the pause button on an exercise route', () => {
    renderAt('/exercise/photo-naming');
    expect(screen.getByLabelText(/pause session/i)).toBeTruthy();
  });

  it('stays out of the way everywhere else', () => {
    renderAt('/today');
    expect(screen.queryByLabelText(/pause session/i)).toBeNull();
  });

  it('opens the paused overlay', () => {
    renderAt('/exercise/minimal-pairs');
    fireEvent.click(screen.getByLabelText(/pause session/i));
    expect(screen.getByRole('dialog', { name: /session paused/i })).toBeTruthy();
  });

  it('hides the pause button while the overlay is up, and restores it on resume', () => {
    renderAt('/exercise/minimal-pairs');
    fireEvent.click(screen.getByLabelText(/pause session/i));
    expect(screen.queryByLabelText(/pause session/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /resume/i }));
    expect(screen.queryByRole('dialog', { name: /session paused/i })).toBeNull();
    expect(screen.getByLabelText(/pause session/i)).toBeTruthy();
  });

  it('does not stop the voice merely by rendering', () => {
    // The control is mounted on every exercise screen. If it silenced audio on
    // mount it would cut Maya off at the start of every single exercise.
    renderAt('/exercise/two-clues');
    expect(stopAllVoiceMock).not.toHaveBeenCalled();
  });
});
