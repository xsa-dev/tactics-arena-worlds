import { chromium } from "@playwright/test";

const browser = await chromium.launch();

async function capture(name, viewport, language, touch = false) {
  const context = await browser.newContext({
    viewport,
    hasTouch: touch,
    isMobile: touch,
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:4174/?lang=${language}`);
  const dismiss = page.getByTestId("onboarding-dismiss");
  if (await dismiss.isVisible()) await dismiss.click();
  await page.waitForFunction(() =>
    window.__TACTICS__.eventNames().includes("battle_started"),
  );
  const canvas = page.locator("canvas");
  await canvas.waitFor({ state: "visible" });
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas did not render");
  const scale = box.width / 960;
  const point = { x: (20 + 33) * scale, y: (66 + 66 + 33) * scale };
  if (touch) await page.touchscreen.tap(box.x + point.x, box.y + point.y);
  else await page.mouse.click(box.x + point.x, box.y + point.y);
  await page.waitForTimeout(250);
  await page.screenshot({
    path: `artifacts/screenshots/${name}.png`,
    fullPage: true,
  });
  await context.close();
}

await capture("desktop-1280x720-en", { width: 1280, height: 720 }, "en");
await capture("mobile-640x360-ru", { width: 640, height: 360 }, "ru", true);
await browser.close();
