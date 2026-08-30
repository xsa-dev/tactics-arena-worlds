import { describe, expect, it } from "vitest";
import { LocalPlatformService } from "../../src/platform";
import { BattleSession } from "../../src/platform/battle-session";

describe("Rules analytics boundary", () => {
  it("emits rules_opened without implying help_requested", () => {
    const platform = new LocalPlatformService("en");
    const session = new BattleSession(
      platform,
      {
        sessionId: "rules-session",
        testerId: "tester",
        manifestVersion: "0.1.0",
        releaseProfile: "study-draft",
        deviceClass: "desktop",
        inputType: "mouse",
        viewport: "1280x720",
        locale: "en",
      },
      "rules-battle",
      () => 10,
    );
    session.start();
    session.rulesOpened();
    expect(platform.events.map(({ name }) => name)).toEqual([
      "battle_started",
      "rules_opened",
    ]);
  });
});
