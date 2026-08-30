import type { ReleaseConfig } from "./config";

export const ALLOWED_PERSISTENT_KEYS = ["tactics-onboarding-v1"] as const;

export class ReleasePreferences {
  constructor(private readonly storage: Storage) {}

  dismissOnboarding(): void {
    this.storage.setItem(ALLOWED_PERSISTENT_KEYS[0], "complete");
  }

  isOnboardingDismissed(): boolean {
    return this.storage.getItem(ALLOWED_PERSISTENT_KEYS[0]) === "complete";
  }
}

export function assertNoProgressionPolicy(config: ReleaseConfig): string[] {
  return Object.entries(config.declarations)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);
}
