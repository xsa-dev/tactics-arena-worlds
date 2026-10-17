export type Language = "en" | "ru";

const en = {
  "game.title": "Tactics Arena: Wasteland",
  "phase.player": "SURVIVORS",
  "phase.enemy": "RAIDERS",
  round: "ROUND",
  hp: "HP",
  ap: "AP",
  "action.move": "Move",
  "action.attack": "Attack · 3 AP",
  "action.ability": "Ability",
  "action.aimed-shot": "Aimed Shot · 4 AP",
  "action.burst": "Burst · 5 AP",
  "action.medkit": "Medkit · 3 AP",
  "action.endTurn": "End turn",
  "action.rules": "Rules",
  "action.export": "Export JSON",
  "action.replay": "Play again",
  "ai.status": "AI exhibition · OpenJEV / fallback",
  "ai.speed": "Presentation speed",
  "ai.speed.0.25": "0.25×",
  "ai.speed.0.5": "0.5×",
  "ai.speed.1": "1×",
  "ai.speed.2": "2×",
  "ai.speed.4": "4×",
  "mode.human": "Mode: Human",
  "mode.ai": "Mode: AI Auto",
  "locale.switch": "RU",
  "wallet.connect": "Connect Wallet",
  "wallet.connected": "Wallet",
  "wallet.seekerVerified": "SEEKER VERIFIED",
  "proof.sign": "Sign Battle Proof",
  "proof.signed": "Proof Signed",
  "proof.verify": "Verify Proof",
  "proof.verified": "Proof Valid",
  "proof.invalid": "Proof Invalid",
  "unit.scout": "Scout",
  "unit.gunner": "Gunner",
  "unit.medic": "Medic",
  "unit.raiderA": "Raider A",
  "unit.raiderB": "Raider B",
  "unit.raiderC": "Raider C",
  "result.victory": "VICTORY",
  "result.defeat": "DEFEAT",
  "result.rounds": "Rounds",
  "result.duration": "Active time",
  "rotate.title": "Rotate your device",
  "rotate.body": "This battle is played in landscape.",
  "startup.title": "Startup error",
  "startup.body":
    "The game could not start. Check your connection and try again.",
  "startup.sceneFailed": "The battle scene could not start. Retry the game.",
  "startup.retry": "Retry",
  "onboarding.title": "Field briefing",
  "onboarding.1": "1. Tap a Survivor to select them.",
  "onboarding.2": "2. Moving costs 1 AP per tile. Blue cells are reachable.",
  "onboarding.3":
    "3. A normal attack costs 3 AP. Red outlines mark legal targets.",
  "onboarding.4":
    "4. Units on yellow half-cover take 1 less normal or Burst damage.",
  "onboarding.5":
    "5. Once per battle: Scout: Aimed Shot — 4 AP, 4 damage, range 5, ignores half-cover; Gunner: Burst — 5 AP, damages the target and orthogonally adjacent Raiders, cover applies per target; Medic: Medkit — 3 AP, heals 4 HP within range 3, without overheal.",
  "onboarding.6":
    "6. End the turn when ready. Eliminate all Raiders by round 8.",
  "onboarding.dismiss": "Start battle",
  "onboarding.ai.1": "1. Watch the Survivors act automatically.",
  "onboarding.ai.2":
    "2. OpenJEV suggests legal actions; deterministic fallback keeps the battle moving.",
  "onboarding.ai.3":
    "3. Moving costs 1 AP per tile. Blue cells show reachable movement.",
  "onboarding.ai.4":
    "4. Normal attacks cost 3 AP. Red outlines show legal targets.",
  "onboarding.ai.5":
    "5. Abilities remain available once per battle: Aimed Shot, Burst, and Medkit.",
  "onboarding.ai.6":
    "6. Pause or open Rules at any time. Replay starts a fresh battle.",
  "feedback.select": "Select a Survivor",
  "feedback.target": "Choose a highlighted target",
  "feedback.enemy": "Raiders are acting…",
  "feedback.cover": "Cover reduced damage",
  "feedback.defeated": "Unit defeated",
  "reject.battle-complete": "The battle is complete",
  "reject.wrong-phase": "Wait for the Raiders",
  "reject.unit-not-found": "Unit not found",
  "reject.not-player-unit": "You cannot command a Raider",
  "reject.target-not-found": "Target not found",
  "reject.not-enemy": "Choose an enemy",
  "reject.not-ally": "Choose an ally",
  "reject.blocked": "That cell is blocked",
  "reject.out-of-bounds": "That cell is outside the arena",
  "reject.out-of-range": "Target is out of range",
  "reject.line-of-sight-blocked": "A wall blocks line of sight",
  "reject.insufficient-ap": "Not enough AP",
  "reject.ability-unavailable": "Ability already used",
  "reject.target-full-health": "Target is already at full HP",
  "reject.invalid-command": "That action is unavailable",
} as const;

type UiKey = keyof typeof en;

const ru: Record<UiKey, string> = {
  "game.title": "Арена тактики: Пустошь",
  "phase.player": "ВЫЖИВШИЕ",
  "phase.enemy": "РЕЙДЕРЫ",
  round: "РАУНД",
  hp: "ЗД",
  ap: "ОД",
  "action.move": "Ход",
  "action.attack": "Атака · 3 ОД",
  "action.ability": "Способность",
  "action.aimed-shot": "Точный выстрел · 4 ОД",
  "action.burst": "Очередь · 5 ОД",
  "action.medkit": "Аптечка · 3 ОД",
  "action.endTurn": "Завершить ход",
  "action.rules": "Правила",
  "action.export": "Экспорт JSON",
  "action.replay": "Сыграть ещё раз",
  "ai.status": "ИИ-выставка · OpenJEV / резервная политика",
  "ai.speed": "Скорость показа",
  "ai.speed.0.25": "0.25×",
  "ai.speed.0.5": "0.5×",
  "ai.speed.1": "1×",
  "ai.speed.2": "2×",
  "ai.speed.4": "4×",
  "mode.human": "Режим: Игрок",
  "mode.ai": "Режим: Авто-ИИ",
  "locale.switch": "EN",
  "wallet.connect": "Подключить кошелёк",
  "wallet.connected": "Кошелёк",
  "wallet.seekerVerified": "SEEKER ПОДТВЕРЖДЁН",
  "proof.sign": "Подписать бой",
  "proof.signed": "Бой подписан",
  "proof.verify": "Проверить подпись",
  "proof.verified": "Подпись верна",
  "proof.invalid": "Подпись неверна",
  "unit.scout": "Разведчик",
  "unit.gunner": "Стрелок",
  "unit.medic": "Медик",
  "unit.raiderA": "Рейдер А",
  "unit.raiderB": "Рейдер Б",
  "unit.raiderC": "Рейдер В",
  "result.victory": "ПОБЕДА",
  "result.defeat": "ПОРАЖЕНИЕ",
  "result.rounds": "Раунды",
  "result.duration": "Активное время",
  "rotate.title": "Поверните устройство",
  "rotate.body": "Битва проходит в альбомном режиме.",
  "startup.title": "Ошибка запуска",
  "startup.body":
    "Игра не загрузилась. Проверьте соединение и повторите попытку.",
  "startup.sceneFailed": "Сцена битвы не запустилась. Повторите запуск игры.",
  "startup.retry": "Повторить",
  "onboarding.title": "Полевой инструктаж",
  "onboarding.1": "1. Нажмите на Выжившего, чтобы выбрать его.",
  "onboarding.2": "2. Движение стоит 1 ОД за клетку. Синие клетки доступны.",
  "onboarding.3":
    "3. Обычная атака стоит 3 ОД. Красным отмечены доступные цели.",
  "onboarding.4":
    "4. Жёлтое укрытие снижает урон обычной атаки и Очереди на 1.",
  "onboarding.5":
    "5. Раз за битву: Разведчик: Точный выстрел — 4 ОД, 4 урона, дальность 5, игнорирует укрытие; Стрелок: Очередь — 5 ОД, урон цели и соседним по стороне Рейдерам, укрытие учитывается для каждой цели; Медик: Аптечка — 3 ОД, лечит 4 ЗД в радиусе 3 без перелечения.",
  "onboarding.6":
    "6. Завершите ход, когда готовы. Уничтожьте Рейдеров до конца 8-го раунда.",
  "onboarding.dismiss": "Начать битву",
  "onboarding.ai.1": "1. Наблюдайте: Выжившие действуют автоматически.",
  "onboarding.ai.2":
    "2. OpenJEV предлагает легальные действия, а резервная политика обеспечивает прогресс.",
  "onboarding.ai.3":
    "3. Движение стоит 1 ОД за клетку. Синие клетки показывают путь.",
  "onboarding.ai.4":
    "4. Обычная атака стоит 3 ОД. Красные контуры показывают цели.",
  "onboarding.ai.5":
    "5. Способности доступны раз за битву: Точный выстрел, Очередь и Аптечка.",
  "onboarding.ai.6":
    "6. В любой момент откройте Правила. Повтор запускает новую битву.",
  "feedback.select": "Выберите Выжившего",
  "feedback.target": "Выберите подсвеченную цель",
  "feedback.enemy": "Ход Рейдеров…",
  "feedback.cover": "Укрытие снизило урон",
  "feedback.defeated": "Боец выбыл",
  "reject.battle-complete": "Битва завершена",
  "reject.wrong-phase": "Дождитесь хода Рейдеров",
  "reject.unit-not-found": "Боец не найден",
  "reject.not-player-unit": "Рейдером нельзя командовать",
  "reject.target-not-found": "Цель не найдена",
  "reject.not-enemy": "Выберите противника",
  "reject.not-ally": "Выберите союзника",
  "reject.blocked": "Клетка занята",
  "reject.out-of-bounds": "Клетка за пределами арены",
  "reject.out-of-range": "Цель слишком далеко",
  "reject.line-of-sight-blocked": "Стена перекрывает линию огня",
  "reject.insufficient-ap": "Недостаточно ОД",
  "reject.ability-unavailable": "Способность уже использована",
  "reject.target-full-health": "У цели полное здоровье",
  "reject.invalid-command": "Действие недоступно",
};

export const catalogs: Record<Language, Record<UiKey, string>> = { en, ru };

export function normalizeLanguage(language: string | undefined): Language {
  return language?.toLowerCase().startsWith("ru") ? "ru" : "en";
}

export function t(language: Language, key: UiKey): string {
  return catalogs[language][key] ?? catalogs.en[key];
}

export type { UiKey };
