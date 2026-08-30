import { describe, expect, it } from "vitest";
import { BattleSession } from "../../src/platform/battle-session";
import { LocalPlatformService } from "../../src/platform";
import { FROZEN_WINNING_COMMANDS } from "../../src/core/scenario";

const context = {
  sessionId: "session-1",
  testerId: "tester-1",
  manifestVersion: "0.1.0",
  releaseProfile: "study-draft" as const,
  deviceClass: "desktop" as const,
  inputType: "mouse" as const,
  viewport: "1280x720",
  locale: "en" as const,
};

function playWinningBattle(session: BattleSession): void {
  for (const command of FROZEN_WINNING_COMMANDS) {
    if (!session.execute(command).accepted)
      throw new Error(`Rejected ${command.type}`);
  }
}

describe("analytics contract", () => {
  it("emits shared context, matching actions, stable rejections, and exactly-once events", () => {
    let now = 100;
    const platform = new LocalPlatformService("en");
    const session = new BattleSession(platform, context, "battle-1", () => now);
    session.gameLoaded();
    session.gameLoaded();
    session.start();
    session.start();
    session.onboarding("shown");
    session.onboarding("shown");
    session.onboarding("completed");
    session.onboarding("completed");
    session.onboarding("dismissed");
    session.onboarding("dismissed");
    session.select("survivor-scout");
    session.execute({
      type: "move",
      unitId: "survivor-scout",
      to: { x: 99, y: 99 },
    });
    session.execute({
      type: "move",
      unitId: "survivor-gunner",
      to: { x: 2, y: 3 },
    });
    session.execute({
      type: "attack",
      unitId: "survivor-gunner",
      targetId: "raider-b",
    });
    session.execute({
      type: "ability",
      unitId: "survivor-scout",
      targetId: "raider-a",
    });
    session.execute({ type: "end-player-phase" });
    const names = platform.events.map(({ name }) => name);
    expect(names.filter((name) => name === "game_loaded")).toHaveLength(1);
    expect(names.filter((name) => name === "battle_started")).toHaveLength(1);
    expect(names.filter((name) => name === "onboarding_shown")).toHaveLength(1);
    expect(
      names.filter((name) => name === "onboarding_completed"),
    ).toHaveLength(1);
    expect(
      names.filter((name) => name === "onboarding_dismissed"),
    ).toHaveLength(1);
    expect(names.filter((name) => name === "first_action")).toHaveLength(1);
    expect(names).toEqual(
      expect.arrayContaining([
        "unit_selected",
        "invalid_action",
        "move_completed",
        "attack_completed",
        "unit_ability_used",
        "turn_ended",
      ]),
    );
    expect(
      platform.events.find(({ name }) => name === "invalid_action")?.properties
        .reason,
    ).toBe("out-of-bounds");
    expect(
      platform.events.every(({ properties }) =>
        Object.entries(context).every(
          ([key, value]) => properties[key] === value,
        ),
      ),
    ).toBe(true);
  });

  it("pauses active time, distinguishes help, finishes once, and exports study fields", () => {
    let now = 0;
    const platform = new LocalPlatformService("ru");
    const session = new BattleSession(platform, context, "battle-2", () => now);
    session.start();
    now = 1000;
    session.pause();
    now = 6000;
    session.resume();
    session.requestHelp();
    session.provideHelp("technical", "technical_issue");
    session.provideHelp("gameplay", "requested");
    now = 8000;
    playWinningBattle(session);
    const finished = platform.events.filter(
      ({ name }) => name === "battle_finished",
    );
    expect(finished).toHaveLength(1);
    expect(finished[0]?.properties).toMatchObject({
      activeDurationMs: 3000,
      facilitatorHelpUsed: true,
      independentCompletion: false,
      result: "victory",
      rounds: 2,
    });
    const exported = JSON.parse(
      session.export({
        cohortIteration: "initial",
        tacticsExperience: "light",
        comprehension: true,
      }),
    );
    expect(exported).toMatchObject({
      cohortIteration: "initial",
      tacticsExperience: "light",
      comprehension: true,
      facilitatorHelpUsed: true,
      independentCompletion: false,
    });
  });

  it("emits abandonment and replay once without any monetization surface", () => {
    const platform = new LocalPlatformService("en");
    const abandoned = new BattleSession(
      platform,
      context,
      "battle-a",
      () => 10,
    );
    abandoned.start();
    abandoned.abandon();
    abandoned.abandon();
    expect(
      platform.events.filter(({ name }) => name === "battle_abandoned"),
    ).toHaveLength(1);

    const done = new BattleSession(platform, context, "battle-done", () => 20);
    done.start();
    playWinningBattle(done);
    done.replayClicked();
    done.replayClicked();
    expect(
      platform.events.filter(({ name }) => name === "replay_clicked"),
    ).toHaveLength(1);
    expect(
      "showFullscreenAdv" in platform ||
        "showRewardedVideo" in platform ||
        "purchase" in platform,
    ).toBe(false);
  });
});
