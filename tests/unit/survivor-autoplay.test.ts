import { describe, expect, it } from "vitest";
import { dispatch } from "../../src/core/engine";
import { createBattle } from "../../src/core/scenario";
import {
  decisionStateFingerprint,
  deterministicSurvivorFallback,
  enumerateLegalSurvivorCommands,
} from "../../src/core/survivor-autoplay";

 describe("Survivor legal command candidates", () => {
  it("enumerates only dispatchable moves, attacks, abilities, and phase completion", () => {
    const state = createBattle("candidates");
    const decision = enumerateLegalSurvivorCommands(state);
    expect(decision.candidates.length).toBeGreaterThan(1);
    expect(decision.candidates.some(({ command }) => command.type === "move")).toBe(true);
    expect(decision.candidates.some(({ command }) => command.type === "attack")).toBe(true);
    expect(decision.candidates.some(({ command }) => command.type === "ability")).toBe(true);
    expect(decision.candidates.some(({ command }) => command.type === "end-player-phase")).toBe(true);
    for (const candidate of decision.candidates) {
      expect(dispatch(state, candidate.command).accepted).toBe(true);
      expect(candidate.id).toMatch(/^sc-[0-9a-f]{8}$/);
      expect(JSON.stringify(candidate)).not.toContain("undefined");
    }
    expect(decision.candidates.some(({ command }) => command.type === "attack" && command.targetId === "survivor-scout")).toBe(false);
  });

  it("is stable across equivalent state copies and excludes terminal or enemy phases", () => {
    const first = enumerateLegalSurvivorCommands(createBattle("one"));
    const equivalent = createBattle("two");
    equivalent.units = [...equivalent.units].reverse();
    const second = enumerateLegalSurvivorCommands(equivalent);
    expect(first).toEqual(second);
    expect(decisionStateFingerprint(createBattle("one"))).toBe(decisionStateFingerprint(createBattle("two")));

    const enemy = createBattle("enemy");
    enemy.phase = "enemy";
    expect(enumerateLegalSurvivorCommands(enemy).candidates).toEqual([]);
    const terminal = createBattle("terminal");
    terminal.status = "victory";
    expect(enumerateLegalSurvivorCommands(terminal).candidates).toEqual([]);
  });

  it("uses deterministic scoring and always progresses at the action cap", () => {
    const candidates = enumerateLegalSurvivorCommands(createBattle("fallback")).candidates;
    expect(deterministicSurvivorFallback(candidates)).toEqual(deterministicSurvivorFallback([...candidates].reverse()));
    expect(deterministicSurvivorFallback(candidates, 12).command).toEqual({ type: "end-player-phase" });
  });
});
