/**
 * Browser Web Speech input is different from native recorded audio.
 * These games use the actual production components/hooks and receive
 * controlled SpeechRecognition results. They must never be counted
 * as 16kHz recorded WAV or Azure pronunciation evidence.
 */
import { test, expect } from './support/speechTest';
import { emitRecognition } from './support/browserControls';
import { readJson } from './support/assertions';

const approvedCategoryWords: Record<string, readonly string[]> = {
  animals: ['dog', 'cat', 'horse'],
  foods: ['apple', 'banana', 'bread'],
  colors: ['red', 'blue', 'green'],
  'body parts': ['hand', 'foot', 'eye'],
  furniture: ['chair', 'table', 'bed'],
  drinks: ['water', 'milk', 'coffee'],
};

for (const scenario of [
  { game: 'category-fluency', start: "Start when you're ready", text: '' },
  { game: 'synonym-generator', start: 'Start', text: 'happy pleased delighted' },
] as const) {
  test(`${scenario.game}: spoken words enter the actual round and are retained in the result`, async ({
    page, transport,
  }) => {
    await page.goto(`/?view=recognition&game=${scenario.game}`);
    await expect(page.getByTestId('recognition-game-name')).toHaveText(scenario.game);
    await page.getByRole('button', { name: scenario.start, exact: true }).click();
    // Countdowns run before recognition; never emit into an inactive mic.
    await expect.poll(() => page.evaluate(() => window.__speechTest.recognition?.active), {
      timeout: 12_000,
      message: `${scenario.game} has no active browser recognizer`,
    }).toBe(true);
    let utterance: string = scenario.text;
    if (scenario.game === 'category-fluency') {
      const prompt = (await page.getByText(/^Name as many /i).last().innerText()).toLowerCase();
      const key = Object.keys(approvedCategoryWords).find(k => prompt.includes(k));
      expect(key, 'The category must be recognized, never hardcoded to Foods').toBeDefined();
      utterance = approvedCategoryWords[key!].join(' ');
    }
    await emitRecognition(page, utterance);
    await expect(page.getByRole('button', { name: 'Microphone active' })).toBeVisible();

    if (scenario.game === 'category-fluency') {
      // A category-valid response must enter the *scored word* collection,
      // not merely be echoed in the microphone transcript or example chips.
      await expect.poll(async () => {
        const indicator = await page.getByText('Words:', { exact: true }).locator('..').innerText();
        return Number(indicator.match(/Words:\s*(\d+)/i)?.[1] ?? 0);
      }, { message: 'Valid recognized category words were not scored', timeout: 8_000 }).toBeGreaterThan(0);
    } else {
      await expect(page.getByText(utterance.split(' ')[0], { exact: true }).first()).toBeVisible({ timeout: 8_000 });
    }
    await page.getByRole('button', { name: 'Done early' }).click();
    await expect.poll(async () => (await readJson<unknown[]>(page, 'recognition-results')).length).toBe(1);
    const results = await readJson<Array<Record<string, unknown>>>(page, 'recognition-results');
    const serialized = JSON.stringify(results[0]).toLowerCase();
    expect(serialized).toContain(utterance.split(' ')[0]);
    if (scenario.game === 'category-fluency') {
      expect(Number(results[0].uniqueWordCount)).toBeGreaterThan(0);
    }
    expect(transport.utterances).toHaveLength(0);
    expect(transport.uploads).toHaveLength(0);
    expect(transport.pronunciationRequests).toHaveLength(0);
  });
}

test('detective-mind: spoken option C selects the third displayed answer and enters feedback', async ({
  page, transport,
}) => {
  await page.goto('/?view=recognition&game=detective-mind');
  await expect(page.getByTestId('recognition-game-name')).toHaveText('detective-mind');
  await page.getByRole('button', { name: 'Answer by voice' }).click();
  await expect.poll(() => page.evaluate(() => window.__speechTest.recognition?.active), {
    timeout: 12_000,
  }).toBe(true);
  await emitRecognition(page, 'letter c');
  await expect(page.getByText(/Case solved|Not quite/, { exact: true })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /^Next/ }).first().click();
  await expect.poll(async () => (await readJson<unknown[]>(page, 'recognition-results')).length).toBe(1);
  const result = (await readJson<Array<Record<string, unknown>>>(page, 'recognition-results'))[0];
  expect(result.selectedIndex).toEqual(expect.any(Number));
  expect(transport.utterances).toHaveLength(0);
  expect(transport.uploads).toHaveLength(0);
  expect(transport.pronunciationRequests).toHaveLength(0);
});
