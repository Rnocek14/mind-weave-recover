import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GameAboutPage from '../GameAboutPage';

function openAbout(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/games/${slug}/about`]}>
      <Routes>
        <Route path="/games/:slug/about" element={<GameAboutPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('8-level About-page safety for newly cataloged games', () => {
  it('makes all eight planned motor stages visible without claiming they are completed clinical levels', () => {
    openAbout('reach-tap');
    expect(screen.getByRole('heading', { name: 'Reach & Tap' })).toBeInTheDocument();
    expect(screen.getByText('Eight proposed practice stages')).toBeInTheDocument();
    expect(screen.getAllByText(/not yet an independently tracked clinical level/i)).toHaveLength(8);
    expect(screen.getByRole('link', { name: 'Open current practice' })).toHaveAttribute(
      'href', '/exercise/reach-tap',
    );
  });

  it('never links a design-only game to a nonexistent standalone route', () => {
    openAbout('sequence-builder');
    expect(screen.getByRole('heading', { name: 'Sequence Builder' })).toBeInTheDocument();
    expect(screen.getAllByText(/not yet an independently tracked clinical level/i)).toHaveLength(8);
    expect(screen.queryByRole('link', { name: 'Open current practice' })).toBeNull();
    expect(screen.getByText(/does not yet have a dedicated standalone game route/i)).toBeInTheDocument();
  });

  it('preserves the existing therapy overview for established games', () => {
    openAbout('photo-naming');
    expect(screen.getByText('Clinical rungs')).toBeInTheDocument();
    expect(screen.queryByText('Eight proposed practice stages')).toBeNull();
  });
});
