import type { Language } from "../localization";
import type { ReleaseConfig } from "./config";

export const ALLOWED_PERSISTENT_KEYS = [
  "tactics-onboarding-v1",
  "tactics-locale-v1",
] as const;

export const ALLOWED_SESSION_KEYS = [
  "tactics-mwa-auth-v1",
  "tactics-battle-proof-v1",
] as const;

export class ReleasePreferences {
  constructor(private readonly storage: Storage) {}

  dismissOnboarding(): void {
    this.storage.setItem(ALLOWED_PERSISTENT_KEYS[0], "complete");
  }

  isOnboardingDismissed(): boolean {
    return this.storage.getItem(ALLOWED_PERSISTENT_KEYS[0]) === "complete";
  }

  getLocale(): Language | null {
    const value = this.storage.getItem(ALLOWED_PERSISTENT_KEYS[1]);
    return value === "en" || value === "ru" ? value : null;
  }

  setLocale(language: Language): void {
    this.storage.setItem(ALLOWED_PERSISTENT_KEYS[1], language);
  }
}

export function assertNoProgressionPolicy(config: ReleaseConfig): string[] {
  return Object.entries(config.declarations)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);
}
