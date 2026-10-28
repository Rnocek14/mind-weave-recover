/**
 * Authenticated game-entry audit: exercise-specific readiness, not generic chrome.
 * These tests create only disposable staging users. No answers are submitted.
 * Passing entry does not establish scoring, completion, persistence or clinical accuracy.
 */
import type { Page, Locator } from '@playwright/test';
import { test, expect } from './fixtures/anonSession';

type GameEntry = { slug: string; ready: (page: Page) => Locator };
const games: GameEntry[] = [
  { slug: 'photo-naming', ready: page => page.getByText('Say what you see', { exact: true }) },
  { slug: 'fix-sentence', ready: page => page.getByText(/Find the wrong word and say a better one/) },
  { slug: 'minimal-pairs', ready: page => page.getByRole('button', { name: 'Start Practice', exact: true }) },
  { slug: 'meaning-match', ready: page => page.getByRole('heading', { name: 'Pick the best meaning:', exact: true }) },
  { slug: 'two-clues', ready: page => page.getByText('What word connects these clues?', { exact: true }) },
  { slug: 'semantic-features', ready: page => page.getByText('Select the features that describe this word', { exact: true }) },
  { slug: 'detective-mind', ready: page => page.getByRole('heading', { level: 2, name: /📂/ }) },
  { slug: 'multi-step-plan', ready: page => page.getByText('Plan the steps to:', { exact: true }) },
  { slug: 'pattern-match', ready: page => page.getByText(/Remember this pattern|Find the matching pattern/) },
  { slug: 'sentence-construction', ready: page => page.getByRole('button', { name: /Hear Sentence|Hear Again|Hear it/ }) },
  { slug: 'phonological-awareness', ready: page => page.getByRole('button', { name: /^(Listen|Replay)$/ }) },
  { slug: 'dual-load-naming', ready: page => page.getByText('Remember these 3 words:', { exact: true }) },
  { slug: 'category-fluency', ready: page => page.getByRole('button', { name: "Start when you're ready", exact: true }) },
  { slug: 'synonym-generator', ready: page => page.getByRole('button', { name: 'Start', exact: true }) },
  { slug: 'describe-guess', ready: page => page.getByText(/Describe this.*without.*saying the word/) },
  { slug: 'narrative-retell', ready: page => page.getByRole('heading', { level: 2, name: /📂/ }) },
  { slug: 'abstract-compare', ready: page => page.getByText('How are these two things similar?', { exact: true }) },
  { slug: 'thought-continuation', ready: page => page.getByRole('button', { name: 'Start Practice', exact: true }) },
];
const groups = Array.from({ length: Math.ceil(games.length / 4) }, (_, index) => games.slice(index * 4, index * 4 + 4));

test.describe('Audit: real game content becomes available on desktop and mobile', () => {
  groups.forEach((group, index) => {
    test(`group ${index + 1}: ${group.map(game => game.slug).join(', ')}`, async ({ anonPage: page }) => {
      test.setTimeout(180_000);
      const failures: string[] = [];
      const javascriptErrors: string[] = [];
      page.on('pageerror', error => javascriptErrors.push(error.message));
      // Reuse one fresh anonymous user per group to avoid 36 sign-ups.
      for (const game of group) {
        const route = `/exercise/${game.slug}`;
        javascriptErrors.length = 0;
        try {
          const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 20_000 });
          expect(response?.ok(), `${route} document request failed`).toBe(true);
          await expect(page, `${route} redirected away from the selected game`)
            .toHaveURL(new RegExp(`/exercise/${game.slug}$`), { timeout: 12_000 });
          // A global Back/Pause button or the loading escape hatch must NOT pass.
          await expect(game.ready(page).first(), `${route}: game-specific content never appeared`)
            .toBeVisible({ timeout: 18_000 });
          await expect(page.getByText("We couldn't load your practice", { exact: true })).toHaveCount(0);
          expect(
            javascriptErrors.length,
            `${route} uncaught browser errors: ${javascriptErrors.slice(0, 4).map(message => message.slice(0, 280)).join(' | ')}`,
          ).toBe(0);
        } catch (error) {
          // Inspect remaining routes even when one fails; fail the test at end.
          const detail = error instanceof Error ? error.message.split('\n').slice(0, 5).join(' ') : String(error);
          failures.push(`${route}: ${detail}`);
        }
      }
      expect(failures, `Game entry failures:\n${failures.join('\n')}`).toEqual([]);
    });
  });
});
