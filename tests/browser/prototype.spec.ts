import { expect, test, type Page } from "@playwright/test";

async function dismissOnboarding(page: Page): Promise<void> {
  const start = page.getByTestId("onboarding-dismiss");
  if (await start.isVisible()) await start.click();
  await expect
    .poll(() => page.evaluate(() => window.__TACTICS__.eventNames()))
    .toContain("battle_started");
}

function boardPoint(x: number, y: number, scale = 1): { x: number; y: number } {
  return { x: (20 + x * 66 + 33) * scale, y: (66 + y * 66 + 33) * scale };
}

async function tapCell(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas missing");
  const scale = box.width / 960;
  const point = boardPoint(x, y, scale);
  await page.mouse.click(box.x + point.x, box.y + point.y);
}

test("desktop legal player/enemy turn pauses and resumes without duplicate state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/?lang=en");
  await expect(page.getByTestId("game-shell")).toBeVisible();
  const readiness = await page.evaluate(() => ({
    interactive: window.__TACTICS__.interactiveReady,
    names: window.__TACTICS__.eventNames(),
  }));
  expect(readiness.interactive).toBe(true);
  expect(readiness.names.indexOf("game_loaded")).toBeGreaterThan(
    readiness.names.indexOf("battle_started"),
  );
  await dismissOnboarding(page);
  await expect
    .poll(() => page.evaluate(() => window.__TACTICS__.eventNames()))
    .toContain("battle_started");
  await page.evaluate(() =>
    window.__TACTICS__.provideHelp("technical", "technical_issue"),
  );
  const helpEvent = await page.evaluate(() =>
    window.__TACTICS__
      .analytics()
      .find(({ name }) => name === "facilitator_help_provided"),
  );
  expect(helpEvent?.properties).toMatchObject({
    helpType: "technical",
    helpReason: "technical_issue",
  });
  const beforeRules = await page.evaluate(() => window.__TACTICS__.snapshot());
  await page.getByTestId("rules").click();
  await expect(page.getByTestId("onboarding-dismiss")).toBeVisible();
  expect(await page.evaluate(() => window.__TACTICS__.snapshot())).toEqual(
    beforeRules,
  );
  await page.getByTestId("onboarding-dismiss").click();
  const rulesEvents = await page.evaluate(() =>
    window.__TACTICS__.eventNames(),
  );
  expect(rulesEvents).toContain("rules_opened");
  expect(rulesEvents).not.toContain("help_requested");
  await tapCell(page, 0, 1);
  await page.getByTestId("ability-action").click();
  await tapCell(page, 5, 1);
  await page.getByTestId("end-turn").click();
  const committed = await page.evaluate(() => window.__TACTICS__.snapshot());
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__TACTICS__.snapshot())).toEqual(
    committed,
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect
    .poll(() => page.evaluate(() => window.__TACTICS__.snapshot().phase))
    .toBe("player");
  expect(
    (await page.evaluate(() => window.__TACTICS__.eventNames())).filter(
      (name) => name === "turn_ended",
    ),
  ).toHaveLength(1);
});

test("640x360 touch flow supports both locales, frozen win, result and fresh replay", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 640, height: 360 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto("/?lang=ru");
  await expect(page.getByTestId("end-turn")).toHaveText("Завершить ход");
  const onboardingMetrics = await page
    .locator("#onboarding .panel")
    .evaluate((panel) => {
      const dismiss = panel.querySelector<HTMLButtonElement>(
        "#onboarding-dismiss",
      );
      const boundary = panel.getBoundingClientRect();
      const button = dismiss?.getBoundingClientRect();
      return {
        panelTop: boundary.top,
        panelBottom: boundary.bottom,
        viewportHeight: innerHeight,
        dismissVisible:
          Boolean(button) &&
          button!.top >= boundary.top &&
          button!.bottom <= boundary.bottom,
        pageScrolls:
          document.documentElement.scrollHeight > innerHeight ||
          document.body.scrollHeight > innerHeight,
        abilityLines: panel.querySelectorAll(".ability-rule").length,
      };
    });
  expect(onboardingMetrics.panelTop).toBeGreaterThanOrEqual(24);
  expect(onboardingMetrics.panelBottom).toBeLessThanOrEqual(
    onboardingMetrics.viewportHeight - 24,
  );
  expect(onboardingMetrics.dismissVisible).toBe(true);
  expect(onboardingMetrics.pageScrolls).toBe(false);
  expect(onboardingMetrics.abilityLines).toBe(3);
  await dismissOnboarding(page);
  const controlMetrics = await page
    .locator("#game-controls button")
    .evaluateAll((buttons) =>
      buttons.map((button) => {
        const style = getComputedStyle(button);
        return {
          height: button.getBoundingClientRect().height,
          fontSize: Number.parseFloat(style.fontSize),
          clipped:
            button.scrollWidth > button.clientWidth ||
            button.scrollHeight > button.clientHeight,
        };
      }),
    );
  expect(
    controlMetrics.every(
      ({ height, fontSize, clipped }) =>
        height >= 44 && fontSize >= 14 && !clipped,
    ),
    JSON.stringify(controlMetrics),
  ).toBe(true);
  const canvas = page.locator("canvas");
  const tap = async (x: number, y: number) => {
    const box = await canvas.boundingBox();
    if (!box) throw new Error("canvas missing");
    const p = boardPoint(x, y, box.width / 960);
    await page.touchscreen.tap(box.x + p.x, box.y + p.y);
  };
  await tap(0, 1);
  await page.getByTestId("ability-action").tap();
  await tap(5, 1);
  await tap(0, 3);
  await page.getByTestId("move-action").tap();
  await tap(2, 3);
  await page.getByTestId("attack-action").tap();
  await tap(6, 3);
  await tap(1, 4);
  await page.getByTestId("move-action").tap();
  await tap(2, 4);
  await page.getByTestId("attack-action").tap();
  await tap(6, 4);
  await page.getByTestId("end-turn").tap();
  await expect
    .poll(() => page.evaluate(() => window.__TACTICS__.snapshot().round), {
      timeout: 5000,
    })
    .toBe(2);
  await expect(page.getByTestId("end-turn")).toBeEnabled({ timeout: 5000 });
  await tap(0, 1);
  await page.getByTestId("attack-action").tap();
  await tap(4, 1);
  await tap(2, 3);
  await page.getByTestId("ability-action").tap();
  await tap(6, 3);
  await tap(2, 4);
  await page.getByTestId("attack-action").tap();
  await tap(6, 4);
  await expect(page.getByTestId("result-overlay")).toContainText("ПОБЕДА");
  const previousId = await page.evaluate(
    () => window.__TACTICS__.snapshot().battleId,
  );
  await page.getByTestId("replay").tap();
  await expect
    .poll(() => page.evaluate(() => window.__TACTICS__.snapshot().battleId))
    .not.toBe(previousId);
  await expect(page.getByTestId("result-overlay")).toBeHidden();
  await expect(page.locator("body")).toHaveJSProperty("scrollHeight", 360);
  await context.close();
});

test("portrait blocks commands with localized rotate screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/?lang=ru");
  await expect(page.getByTestId("rotate-overlay")).toBeVisible();
  await expect(page.getByTestId("rotate-overlay")).toContainText(
    "Поверните устройство",
  );
  await expect(page.getByTestId("game-controls")).toHaveAttribute("inert", "");
});

test("missing required controls suppress readiness and shows a localized recoverable error", async ({
  page,
}) => {
  await page.route("**/?lang=ru", async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      'id="game-controls"',
      'id="missing-controls"',
    );
    await route.fulfill({ response, body });
  });
  await page.goto("/?lang=ru");
  await expect(page.locator("#startup-error")).toBeVisible();
  await expect(page.locator("#startup-error")).toContainText("Ошибка запуска");
  await expect(page.locator("#startup-error-retry")).toContainText("Повторить");
});

test("Phaser scene failure suppresses readiness and shows a localized recoverable error", async ({
  page,
}) => {
  await page.route("**/src/presentation/BattleScene.ts*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const body = source.replace(
      'this.draw();\n      this.runtime.markReady("scene");',
      'throw new Error("forced scene failure");',
    );
    if (body === source)
      throw new Error("BattleScene failure hook did not match");
    await route.fulfill({ response, body });
  });
  await page.goto("/?lang=ru");
  await expect(page.locator("#startup-error")).toBeVisible();
  await expect(page.locator("#startup-error")).toContainText("Ошибка запуска");
  await expect(page.locator("#startup-error-retry")).toContainText("Повторить");
  await expect
    .poll(() => page.evaluate(() => window.__TACTICS__.interactiveReady))
    .toBe(false);
});

test("refresh starts a new deterministic battle while preserving only onboarding dismissal", async ({
  page,
}) => {
  await page.goto("/?lang=en");
  await dismissOnboarding(page);
  const first = await page.evaluate(
    () => window.__TACTICS__.snapshot().battleId,
  );
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => window.__TACTICS__.interactiveReady))
    .toBe(true);
  const after = await page.evaluate(() => ({
    battleId: window.__TACTICS__.snapshot().battleId,
    keys: Object.keys(localStorage),
  }));
  expect(after.battleId).not.toBe(first);
  expect(after.keys).toEqual(["tactics-onboarding-v1"]);
  await expect(page.getByTestId("onboarding-dismiss")).toBeHidden();
});
