import { describe, expect, it } from "vitest";
import { catalogs, normalizeLanguage, t } from "../../src/localization";

describe("localization contract", () => {
  it("normalizes Russian variants and falls back to English", () => {
    expect(normalizeLanguage("ru-RU")).toBe("ru");
    expect(normalizeLanguage("en-US")).toBe("en");
    expect(normalizeLanguage("tr")).toBe("en");
    expect(t("ru", "action.endTurn")).toBe("Завершить ход");
  });

  it("has a nonempty Russian and English value for every required UI key", () => {
    expect(Object.keys(catalogs.ru).sort()).toEqual(
      Object.keys(catalogs.en).sort(),
    );
    for (const catalog of Object.values(catalogs)) {
      expect(
        Object.values(catalog).every((value) => value.trim().length > 0),
      ).toBe(true);
    }
  });

  it("teaches every role's once-per-battle ability in both onboarding catalogs", () => {
    expect(catalogs.en["onboarding.5"]).toContain("Scout: Aimed Shot");
    expect(catalogs.en["onboarding.5"]).toContain("Gunner: Burst");
    expect(catalogs.en["onboarding.5"]).toContain("Medic: Medkit");
    expect(catalogs.ru["onboarding.5"]).toContain("Разведчик: Точный выстрел");
    expect(catalogs.ru["onboarding.5"]).toContain("Стрелок: Очередь");
    expect(catalogs.ru["onboarding.5"]).toContain("Медик: Аптечка");
  });
});
