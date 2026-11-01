import { expect, test } from "@playwright/test";

/** Real clinician cards in synthetic harness; no real patient data or backend. */
for (const { width, label } of [
  { width: 320, label: "small phone" },
  { width: 375, label: "phone" },
  { width: 768, label: "tablet" },
  { width: 1440, label: "desktop" },
]) {
  test("clinical review remains interpretable without sideways scrolling on " + label, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?view=metrics");

    await expect(page.getByRole("heading", { name: "Practice data available" })).toBeVisible();
    await expect(page.getByText("Higher app scores")).toBeVisible();
    await expect(page.getByText(/Not a prescribed therapy target/)).toBeVisible();
    await expect(page.getByText(/not a diagnosis or validated recovery status/)).toBeVisible();
    await expect(page.getByText("On track")).toHaveCount(0);
    await expect(page.getByText("Recovery is stable")).toHaveCount(0);

    const button = page.getByRole("button", { name: /Review Synthetic Patient/ });
    await expect(button).toBeVisible();
    const bounds = await button.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);

    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
  });
}

test("clinician can open selected patient with keyboard rather than mouse", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/?view=metrics");
  const button = page.getByRole("button", { name: /Review Synthetic Patient/ });
  await button.focus();
  await expect(button).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText(/Opened synthetic-patient/);
});
