import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Progress } from '@/components/ui/progress';

describe('shared accessible progress bar', () => {
  it.each([0, 25, 50, 100])('reports actual %s percent completion to screen readers', (percent) => {
    const { unmount } = render(<Progress value={percent} aria-label="Clinical practice progress" />);
    const bar = screen.getByRole('progressbar', { name: 'Clinical practice progress' });
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(bar.getAttribute('aria-valuenow')).toBe(String(percent));
    unmount();
  });
});
