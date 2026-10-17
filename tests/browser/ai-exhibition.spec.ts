import { expect, test } from "@playwright/test";

test("AI exhibition advances without board input and keeps human board controls disabled", async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto("/?lang=en");
  await expect(page.locator("[data-testid=onboarding-dismiss]")).toBeVisible();
  await page.locator("[data-testid=onboarding-dismiss]").click();
  await expect
    .poll(async () => page.evaluate(() => window.__TACTICS__?.interactiveReady))
    .toBe(true);

  const before = await page.evaluate(() => window.__TACTICS__.snapshot());
  await page.locator("#speed-2").click();
  await expect(page.locator("#speed-2")).toHaveClass(/active/);

  // Pause via blur and resume via focus during autoplay without duplicating state
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  const pausedSnapshot = await page.evaluate(() =>
    window.__TACTICS__.snapshot(),
  );
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__TACTICS__.snapshot())).toEqual(
    pausedSnapshot,
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));

  await page.locator("#speed-4").click();
  await expect(page.locator("#speed-4")).toHaveClass(/active/);
  await page.waitForTimeout(3000);
  const after = await page.evaluate(() => window.__TACTICS__.snapshot());

  expect(after.round).toBeGreaterThan(before.round);
  expect(await page.locator("#ai-status").textContent()).toContain("OpenJEV");
  await expect(page.locator("#move-action")).toBeDisabled();
  await expect(page.locator("#attack-action")).toBeDisabled();
  await expect(page.locator("#ability-action")).toBeDisabled();
  await expect(page.locator("#end-turn")).toBeDisabled();
});
