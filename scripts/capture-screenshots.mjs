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
  await page.waitForTimeout(350);
  await page.screenshot({
    path: `artifacts/screenshots/${name}.png`,
    fullPage: true,
  });
  await context.close();
}

async function captureCover(name, title, subtitle, badges) {
  const context = await browser.newContext({
    viewport: { width: 800, height: 470 },
  });
  const page = await context.newPage();
  await page.setContent(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 800px;
    height: 470px;
    overflow: hidden;
    background: radial-gradient(circle at 65% 45%, #232d31 0%, #14191c 68%, #0d1113 100%);
    color: #f4ead3;
    font-family: "Trebuchet MS", "Segoe UI", sans-serif;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 38px 42px;
    position: relative;
  }
  .grid-bg {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(to right, rgba(211, 168, 78, 0.08) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(211, 168, 78, 0.08) 1px, transparent 1px);
    background-size: 48px 48px;
    pointer-events: none;
  }
  .copy {
    position: relative;
    z-index: 2;
    max-width: 410px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .eyebrow {
    display: inline-block;
    align-self: flex-start;
    padding: 5px 12px;
    background: rgba(243, 197, 94, 0.16);
    border: 1.5px solid #d3a84e;
    border-radius: 6px;
    color: #f3c55e;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  h1 {
    font-size: 44px;
    line-height: 1.04;
    letter-spacing: 0.02em;
    color: #f4ead3;
    text-shadow: 0 4px 16px rgba(0,0,0,0.65);
  }
  h1 span {
    display: block;
    color: #f3c55e;
    font-size: 30px;
    margin-top: 6px;
  }
  p {
    font-size: 16px;
    line-height: 1.4;
    color: #d5ccb8;
  }
  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 4px;
  }
  .badge {
    padding: 6px 11px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
    background: #1d2528;
    border: 1px solid #59676b;
    color: #e8dec8;
  }
  .board {
    position: relative;
    z-index: 2;
    width: 280px;
    height: 360px;
    background: #192124;
    border: 2px solid #d3a84e;
    border-radius: 12px;
    padding: 16px;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-template-rows: repeat(5, 1fr);
    gap: 8px;
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.55);
  }
  .tile {
    background: #232c30;
    border: 1px solid #354247;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  .tile.cover {
    border-color: #d3a84e;
    background: #2c3429;
  }
  .tile.wall {
    background: #39312b;
    border-color: #6b5849;
  }
  .unit {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 13px;
    box-shadow: 0 3px 8px rgba(0,0,0,0.5);
  }
  .survivor {
    background: #53b86a;
    border: 2px solid #d9fbe0;
    color: #0e1e12;
  }
  .raider {
    background: #d84b42;
    border: 2px solid #ffd5d1;
    color: #220907;
  }
</style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="copy">
    <div class="eyebrow">8×6 Turn-Based Squad Tactics</div>
    <h1>${title}<span>${subtitle}</span></h1>
    <p>${badges.description}</p>
    <div class="badges">
      ${badges.items.map((item) => `<span class="badge">${item}</span>`).join("")}
    </div>
  </div>
  <div class="board">
    <div class="tile"><div class="unit survivor">SCT</div></div>
    <div class="tile"></div>
    <div class="tile cover"></div>
    <div class="tile"><div class="unit raider">R1</div></div>
    <div class="tile"></div>
    <div class="tile cover"><div class="unit survivor">GNR</div></div>
    <div class="tile wall"></div>
    <div class="tile"></div>
    <div class="tile"></div>
    <div class="tile"></div>
    <div class="tile cover"></div>
    <div class="tile"><div class="unit raider">R2</div></div>
    <div class="tile"><div class="unit survivor">MED</div></div>
    <div class="tile wall"></div>
    <div class="tile"></div>
    <div class="tile"></div>
    <div class="tile"></div>
    <div class="tile"></div>
    <div class="tile cover"><div class="unit raider">R3</div></div>
    <div class="tile"></div>
  </div>
</body>
</html>`);
  await page.screenshot({
    path: `artifacts/screenshots/${name}.png`,
  });
  await context.close();
}

await capture("desktop-1280x720-en", { width: 1280, height: 720 }, "en");
await capture("desktop-1280x720-ru", { width: 1280, height: 720 }, "ru");
await capture("mobile-640x360-ru", { width: 640, height: 360 }, "ru", true);
await captureCover("cover-800x470", "TACTICS ARENA", "WASTELAND", {
  description:
    "Command Scout, Gunner, and Medic across an 8×6 tactical grid with cover, line-of-sight, and squad abilities.",
  items: ["Aimed Shot", "Burst", "Medkit", "Deterministic 8×6"],
});
await browser.close();
