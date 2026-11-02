import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { UnverifiedPracticeBanner } from '@/components/exercise/UnverifiedPracticeBanner';

describe('UnverifiedPracticeBanner', () => {
  it('announces the unsaved result in plain language and offers a large exit', () => {
    render(
      <MemoryRouter initialEntries={['/exercise']}>
        <Routes>
          <Route path="/exercise" element={<UnverifiedPracticeBanner />} />
          <Route path="/today" element={<h1>Today</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Results not saved');
    expect(alert.textContent).toContain('care partner');
    fireEvent.click(screen.getByRole('button', { name: 'Return to Today' }));
    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy();
  });
});
