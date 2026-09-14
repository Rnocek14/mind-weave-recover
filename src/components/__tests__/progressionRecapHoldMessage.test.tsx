/**
 * After a session answered entirely by tapping, the recap must not say "your
 * work still counts" — recognition earns no expressive credit (progression
 * spec §5.4), so nothing could have moved. It says what would.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  PhotoNamingProgressionRecap,
  RECOGNITION_ONLY_HOLD_MESSAGE,
} from '@/components/PhotoNamingProgressionRecap';

const held = { prev: { level: 1, progressPct: 0 }, next: { level: 1, progressPct: 0 }, leveledUp: false };

describe('Photo Naming recap after a tap-only session', () => {
  it('tells the patient what moves the level instead of "your work still counts"', () => {
    render(<PhotoNamingProgressionRecap {...held} recognitionOnly onContinue={() => {}} />);
    expect(screen.getByText(RECOGNITION_ONLY_HOLD_MESSAGE)).toBeTruthy();
    expect(screen.queryByText(/your work still counts/i)).toBeNull();
  });

  it('keeps the neutral line when the patient did attempt to speak', () => {
    render(<PhotoNamingProgressionRecap {...held} recognitionOnly={false} onContinue={() => {}} />);
    expect(screen.getByText(/your work still counts/i)).toBeTruthy();
    expect(screen.queryByText(RECOGNITION_ONLY_HOLD_MESSAGE)).toBeNull();
  });
});
