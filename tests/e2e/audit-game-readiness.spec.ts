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
  // Additional practice-catalog routes missing from the previous 18-route audit.
  { slug: 'functional-scenes', ready: page => page.getByRole('button', { name: 'Next scene', exact: true }) },
  { slug: 'reach-tap', ready: page => page.getByRole('heading', { name: 'Reach & Tap', exact: true }) },
  { slug: 'left-side-hunt', ready: page => page.getByRole('heading', { name: 'Left-Side Hunt', exact: true }) },
  { slug: 'word-practice', ready: page => page.getByRole('heading', { name: 'Phrase Practice', exact: true }) },
  { slug: 'conversation-partner', ready: page => page.getByRole('button', { name: 'Start Conversation', exact: true }) },
  { slug: 'conversation-coach', ready: page => page.getByRole('heading', { name: 'Smart Conversation Practice', exact: true }) },
];
// Twelve routes per authenticated synthetic account, rather than four.
// Assertions still run independently for EVERY route; failed routes accumulate.
const GROUP_SIZE = 12;
const groups = Array.from({ length: Math.ceil(games.length / GROUP_SIZE) }, (_, index) => games.slice(index * GROUP_SIZE, (index + 1) * GROUP_SIZE));

test.describe('Audit: real game content becomes available on desktop and mobile', () => {
  // Configured before fixtures start: applies to real anonymous auth + browser
  // setup, not only the body. Per-game readiness remains capped at 18 seconds.
  test.describe.configure({ timeout: 330_000 });
  groups.forEach((group, index) => {
    test(`group ${index + 1}: ${group.map(game => game.slug).join(', ')}`, async ({ anonPage: page }) => {
      const failures: string[] = [];
      // Each route gets its own page, so WebKit does not attribute an
      // aborted request from the previous route's teardown to the next game.
      // We still fail on every uncaught exception in the game under test.
      const context = page.context();
      for (const game of group) {
        const route = `/exercise/${game.slug}`;
        const gamePage = await context.newPage();
        const javascriptErrors: string[] = [];
        const failedBackendRequests: string[] = [];
        gamePage.on('pageerror', error => javascriptErrors.push(error.message));
        gamePage.on('requestfailed', request => {
          try {
            const url = new URL(request.url());
            if (url.hostname.endsWith('.supabase.co')) {
              failedBackendRequests.push(url.pathname + ': ' + (request.failure()?.errorText ?? 'failed'));
            }
          } catch { /* browser/internal scheme, no diagnostic needed */ }
        });
        try {
          const response = await gamePage.goto(route, { waitUntil: 'domcontentloaded', timeout: 20_000 });
          expect(response?.ok(), `${route} document request failed`).toBe(true);
          await expect(gamePage, `${route} redirected away from the selected game`)
            .toHaveURL(new RegExp(`/exercise/${game.slug}$`), { timeout: 12_000 });
          await expect(game.ready(gamePage).first(), `${route}: game-specific content never appeared`)
            .toBeVisible({ timeout: 18_000 });
          // Generic Exercise.tsx routes must also expose the actual play CTA,
          // not merely render the correct title over an empty game shell.
          if (['reach-tap', 'left-side-hunt', 'word-practice'].includes(game.slug)) {
            await expect(gamePage.getByRole('button', { name: 'Start Exercise', exact: true }))
              .toBeVisible({ timeout: 10_000 });
          }
          await expect(gamePage.getByText("We couldn't load your practice", { exact: true })).toHaveCount(0);
          expect(
            javascriptErrors.length,
            `${route} uncaught browser errors: ${javascriptErrors.slice(0, 4).map(message => message.slice(0, 280)).join(' | ')}`,
          ).toBe(0);
        } catch (error) {
          const detail = error instanceof Error ? error.message.split('\\n').slice(0, 5).join(' ') : String(error);
          const visible = (await gamePage.locator('body').innerText({ timeout: 2000 }).catch(() => '[body unavailable]'))
            .replace(/\\s+/g, ' ').slice(0, 350);
          failures.push(`${route}: ${detail}; visible=${visible}; failedBackendRequests=${failedBackendRequests.slice(0, 5).join(' | ') || 'none'}; pageErrors=${javascriptErrors.slice(0, 3).join(' | ') || 'none'}`);
        } finally {
          await gamePage.close();
        }
      }
      expect(failures, `Game entry failures:\n${failures.join('\n')}`).toEqual([]);
    });
  });
});

test.describe('Audit: rapid repeated Two Clues start without false readiness', () => {
  test.describe.configure({ timeout: 160_000 });
  test('starts the actual puzzle on four separately opened pages for one synthetic account', async ({ anonPage: firstPage }) => {
    test.setTimeout(125_000);
    const context = firstPage.context();
    for (let attempt = 1; attempt <= 4; attempt++) {
      const page = await context.newPage();
      try {
        const failed: string[] = [];
        page.on('requestfailed', request => {
          try {
            const url = new URL(request.url());
            if (url.hostname.endsWith('.supabase.co')) failed.push(url.pathname + ': ' + (request.failure()?.errorText ?? 'failed'));
          } catch { /* ignore non-HTTP schemes */ }
        });
        await page.goto('/exercise/two-clues', { waitUntil: 'domcontentloaded', timeout: 20_000 });
        try {
          await expect(page.getByText('What word connects these clues?', { exact: true }))
            .toBeVisible({ timeout: 18_000 });
          await expect(page.getByRole('button', { name: 'Hear clues' })).toBeVisible();
        } catch (error) {
          const visible = (await page.locator('body').innerText({ timeout: 2000 }).catch(() => '[body unavailable]')).replace(/\\s+/g, ' ').slice(0, 320);
          throw new Error(`Two Clues attempt ${attempt}: ${String(error)}; visible=${visible}; backend failures=${failed.slice(0, 5).join(' | ') || 'none'}`);
        }
      } finally {
        await page.close();
      }
    }
  });
});
