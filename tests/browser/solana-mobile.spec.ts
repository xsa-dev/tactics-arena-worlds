import { expect, test } from "@playwright/test";

test("Solana Mobile profile at 640x360 supports live mode/locale switching, wallet + Seeker badge, and signed battle proof verification", async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.addInitScript(() => {
    const alphabet =
      "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    const encodeBase58 = (bytes: Uint8Array): string => {
      let zeroes = 0;
      while (zeroes < bytes.length && bytes[zeroes] === 0) zeroes += 1;
      const digits = [0];
      for (let i = zeroes; i < bytes.length; i += 1) {
        let carry = bytes[i]!;
        for (let j = 0; j < digits.length; j += 1) {
          carry += digits[j]! << 8;
          digits[j] = carry % 58;
          carry = (carry / 58) | 0;
        }
        while (carry > 0) {
          digits.push(carry % 58);
          carry = (carry / 58) | 0;
        }
      }
      let out = "1".repeat(zeroes);
      for (let i = digits.length - 1; i >= 0; i -= 1)
        out += alphabet[digits[i]!]!;
      return out;
    };

    let cachedPair: CryptoKeyPair | null = null;
    window.__TACTICS_SOLANA_MOCK__ = {
      walletAdapter: {
        async connect() {
          if (!cachedPair) {
            cachedPair = (await crypto.subtle.generateKey("Ed25519", true, [
              "sign",
              "verify",
            ])) as CryptoKeyPair;
          }
          const rawPub = new Uint8Array(
            await crypto.subtle.exportKey("raw", cachedPair.publicKey),
          );
          return {
            address: encodeBase58(rawPub),
            publicKey: rawPub,
            async signMessage(message: Uint8Array) {
              const sig = await crypto.subtle.sign(
                "Ed25519",
                cachedPair!.privateKey,
                new Uint8Array(message),
              );
              return new Uint8Array(sig);
            },
          };
        },
      },
      seekerVerifier: {
        async verifySeekerGenesisToken() {
          return ["SeekerGenesisMint11111111111111111111111111"];
        },
      },
    };
  });

  await page.goto("/?lang=en");
  await expect(page.locator("[data-testid=onboarding-dismiss]")).toBeVisible();
  await page.locator("[data-testid=onboarding-dismiss]").click();
  await expect
    .poll(async () => page.evaluate(() => window.__TACTICS__?.interactiveReady))
    .toBe(true);

  // Verify top controls are visible and >= 44px height with no page scroll at 640x360
  await expect(page.locator("#top-controls")).toBeVisible();
  const modeBox = await page.locator("#mode-toggle").boundingBox();
  const localeBox = await page.locator("#locale-toggle").boundingBox();
  const walletBox = await page.locator("#wallet-button").boundingBox();
  expect(modeBox!.height).toBeGreaterThanOrEqual(44);
  expect(modeBox!.width).toBeGreaterThanOrEqual(44);
  expect(localeBox!.height).toBeGreaterThanOrEqual(44);
  expect(localeBox!.width).toBeGreaterThanOrEqual(44);
  expect(walletBox!.height).toBeGreaterThanOrEqual(44);
  expect(walletBox!.width).toBeGreaterThanOrEqual(44);

  const hasScroll = await page.evaluate(
    () =>
      document.documentElement.scrollHeight > window.innerHeight ||
      document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasScroll).toBe(false);

  // Toggle EN -> RU -> EN live
  await page.locator("#locale-toggle").click();
  await expect(page.locator("#move-action")).toHaveText("Ход");
  await page.locator("#locale-toggle").click();
  await expect(page.locator("#move-action")).toHaveText("Move");

  // Connect wallet and verify Seeker badge appears
  await page.locator("#wallet-button").click();
  await expect(page.locator("#seeker-badge")).toBeVisible();
  await expect(page.locator("#seeker-badge")).toHaveText("SEEKER VERIFIED");

  // Wait for battle_started after startup quiet window
  await expect
    .poll(async () =>
      page.evaluate(() =>
        window.__TACTICS__.eventNames().includes("battle_started"),
      ),
    )
    .toBe(true);

  const canvas = page.locator("canvas");
  const clickCell = async (x: number, y: number) => {
    const box = await canvas.boundingBox();
    const scale = box!.width / 960;
    await page.mouse.click(
      box!.x + (20 + x * 66 + 33) * scale,
      box!.y + (66 + y * 66 + 33) * scale,
    );
  };

  await clickCell(0, 1);
  await page.locator("#ability-action").click();
  await clickCell(5, 1);
  await clickCell(0, 3);
  await clickCell(2, 3);
  await page.locator("#attack-action").click();
  await clickCell(6, 3);
  await clickCell(1, 4);
  await clickCell(2, 4);
  await page.locator("#attack-action").click();
  await clickCell(6, 4);
  await page.locator("#end-turn").click();

  await expect
    .poll(async () => page.evaluate(() => window.__TACTICS__.snapshot().round))
    .toBe(2);
  await expect(page.locator("#end-turn")).toBeEnabled({ timeout: 5000 });

  await clickCell(0, 1);
  await page.locator("#attack-action").click();
  await clickCell(4, 1);
  await clickCell(2, 3);
  await page.locator("#ability-action").click();
  await clickCell(6, 3);
  await clickCell(2, 4);
  await page.locator("#attack-action").click();
  await clickCell(6, 4);

  await expect(page.locator("#result-overlay")).toBeVisible();
  await expect(page.locator("#sign-proof")).toBeVisible();
  await page.locator("#sign-proof").click();

  await expect(page.locator("#verify-proof")).toBeVisible();
  await page.locator("#verify-proof").click();
  await expect(page.locator("#result-proof-status")).toContainText(
    "Proof Valid",
  );

  // Replay and switch to AI Autoplay with 44x44 speed buttons
  await page.locator("#replay").click();
  await page.locator("#mode-toggle").click();
  await expect(page.locator("#ai-speed")).toBeVisible();
  const speed1Box = await page.locator("#speed-1").boundingBox();
  expect(speed1Box!.width).toBeGreaterThanOrEqual(44);
  expect(speed1Box!.height).toBeGreaterThanOrEqual(44);
  await page.locator("#speed-4").click();
  await expect
    .poll(async () => page.evaluate(() => window.__TACTICS__.snapshot().round))
    .toBeGreaterThan(1);
});
