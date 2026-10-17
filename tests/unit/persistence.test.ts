import { describe, expect, it } from "vitest";
import { createReleaseConfig } from "../../src/release/config";
import {
  ALLOWED_PERSISTENT_KEYS,
  ALLOWED_SESSION_KEYS,
  ReleasePreferences,
  assertNoProgressionPolicy,
} from "../../src/release/persistence";

describe("no-progression persistence policy", () => {
  it("stores only onboarding dismissal and declared non-gameplay preferences", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      },
    } satisfies Storage;
    const prefs = new ReleasePreferences(storage);
    prefs.dismissOnboarding();
    expect(prefs.isOnboardingDismissed()).toBe(true);
    expect(prefs.getLocale()).toBeNull();
    prefs.setLocale("ru");
    expect(prefs.getLocale()).toBe("ru");
    expect([...values.keys()]).toEqual([...ALLOWED_PERSISTENT_KEYS]);
    expect(ALLOWED_SESSION_KEYS).toEqual([
      "tactics-mwa-auth-v1",
      "tactics-battle-proof-v1",
    ]);
    expect(
      "battle" in prefs || "progress" in prefs || "inventory" in prefs,
    ).toBe(false);
  });

  it("fails release declarations for progression, cloud saves, achievements, inventory, purchases, or unlocks", () => {
    expect(
      assertNoProgressionPolicy(createReleaseConfig("study-draft")),
    ).toEqual([]);
    for (const flag of [
      "cloudSave",
      "progression",
      "achievements",
      "inventory",
      "purchases",
      "unlocks",
    ] as const)
      expect(
        assertNoProgressionPolicy({
          ...createReleaseConfig("study-draft"),
          declarations: {
            ...createReleaseConfig("study-draft").declarations,
            [flag]: true,
          },
        }),
      ).toContain(flag);
  });
});
