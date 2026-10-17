import Phaser from "phaser";
import { isHalfCover, isWall } from "../core/grid";
import type { Position, Unit } from "../core/types";
import { t } from "../localization";
import type { GameRuntime, PresentationEffect } from "./runtime";

const BOARD_X = 20;
const BOARD_Y = 66;
const CELL = 66;

const cellCenter = (pos: Position): { x: number; y: number } => ({
  x: BOARD_X + pos.x * CELL + CELL / 2,
  y: BOARD_Y + pos.y * CELL + CELL / 2,
});

const easeOutCubic = (tVal: number): number =>
  1 - Math.pow(1 - Math.min(1, Math.max(0, tVal)), 3);

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }
  create(): void {
    this.scene.start("battle");
  }
}

export class BattleScene extends Phaser.Scene {
  private layer?: Phaser.GameObjects.Container;
  private unsubscribe?: () => void;
  private activeEffect: PresentationEffect | null = null;
  private effectStartedAt = 0;
  private lastTime = 0;

  constructor(private readonly runtime: GameRuntime) {
    super("battle");
  }

  create(): void {
    try {
      this.cameras.main.setBackgroundColor("#151a1d");
      this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        const x = Math.floor((pointer.x - BOARD_X) / CELL);
        const y = Math.floor((pointer.y - BOARD_Y) / CELL);
        if (x >= 0 && x < 8 && y >= 0 && y < 6)
          this.runtime.handleCell({ x, y });
      });
      this.unsubscribe = this.runtime.subscribe(() => {
        if (
          this.runtime.lastEffect &&
          this.runtime.lastEffect.id !== this.activeEffect?.id
        ) {
          this.activeEffect = this.runtime.lastEffect;
          this.effectStartedAt = this.lastTime;
        } else if (!this.runtime.lastEffect) {
          this.activeEffect = null;
        }
        this.draw();
      });
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
        this.unsubscribe?.(),
      );
      this.draw();
      this.runtime.markReady("scene");
    } catch {
      this.runtime.failReady("scene", "startup.sceneFailed");
    }
  }

  update(time: number): void {
    this.lastTime = time;
    this.runtime.update(time);
    if (this.activeEffect) {
      const elapsed = time - this.effectStartedAt;
      if (elapsed <= this.activeEffect.durationMs) {
        this.draw(elapsed / Math.max(1, this.activeEffect.durationMs));
      } else {
        this.activeEffect = null;
        this.draw();
      }
    }
  }

  private draw(effectProgress = 1): void {
    this.layer?.destroy(true);
    this.layer = this.add.container(0, 0);
    const graphics = this.add.graphics();
    this.layer.add(graphics);
    const state = this.runtime.displayState;
    const legalCells = new Set(
      this.runtime.legalCells().map(({ x, y }) => `${x},${y}`),
    );
    const legalTargets = new Set(this.runtime.legalTargetIds());

    graphics.fillStyle(0x0c1012, 0.7).fillRoundedRect(10, 10, 940, 48, 8);
    this.addLabel(
      24,
      20,
      t(this.runtime.language, "game.title"),
      24,
      "#f3c55e",
    );
    this.addLabel(
      392,
      21,
      `${t(this.runtime.language, `phase.${state.phase}`)} · ${t(this.runtime.language, "round")} ${state.round}`,
      22,
      state.phase === "player" ? "#7fdef8" : "#ff8e72",
    );

    for (let y = 0; y < state.map.height; y += 1) {
      for (let x = 0; x < state.map.width; x += 1) {
        const position = { x, y } as Position;
        const px = BOARD_X + x * CELL;
        const py = BOARD_Y + y * CELL;
        const wall = isWall(state.map, position);
        const cover = isHalfCover(state.map, position);
        graphics
          .fillStyle(
            wall
              ? 0x394044
              : cover
                ? 0x6b5a25
                : (x + y) % 2
                  ? 0x283136
                  : 0x303a3e,
            1,
          )
          .fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
        graphics
          .lineStyle(1, 0x667277, 0.55)
          .strokeRect(px + 1, py + 1, CELL - 2, CELL - 2);
        if (cover) {
          graphics
            .fillStyle(0xd7b44f, 0.75)
            .fillRect(px + 7, py + CELL - 15, CELL - 14, 8);
          this.addLabel(px + 24, py + 8, "▰", 21, "#e9c761");
        }
        if (wall) {
          graphics.lineStyle(5, 0x1c2225, 1);
          graphics.lineBetween(px + 9, py + 12, px + CELL - 9, py + CELL - 12);
          graphics.lineBetween(px + CELL - 9, py + 12, px + 9, py + CELL - 12);
        }
        if (legalCells.has(`${x},${y}`)) {
          graphics
            .fillStyle(0x3cc9ff, 0.25)
            .fillRect(px + 3, py + 3, CELL - 6, CELL - 6);
          graphics
            .lineStyle(3, 0x61dcff, 0.9)
            .strokeRect(px + 4, py + 4, CELL - 8, CELL - 8);
        }
      }
    }

    const effect = this.activeEffect;
    if (effect && effectProgress < 1 && effect.kind === "move") {
      const fromPt = cellCenter(effect.from);
      const toPt = cellCenter(effect.to);
      graphics
        .lineStyle(3, 0x63ddff, 0.55 * (1 - effectProgress))
        .lineBetween(fromPt.x, fromPt.y, toPt.x, toPt.y);
      graphics
        .fillStyle(0x63ddff, 0.3 * (1 - effectProgress))
        .fillCircle(fromPt.x, fromPt.y, 12);
    }

    for (const unit of state.units)
      this.drawUnit(unit, legalTargets.has(unit.id), effectProgress);

    if (effect && effectProgress < 1) {
      this.drawEffectOverlay(graphics, effect, effectProgress);
    } else if (this.runtime.activeActorId && this.runtime.activeTargetId) {
      const actor = state.units.find(
        ({ id }) => id === this.runtime.activeActorId,
      );
      const target = state.units.find(
        ({ id }) => id === this.runtime.activeTargetId,
      );
      if (actor && target) {
        const ax = BOARD_X + actor.position.x * CELL + CELL / 2;
        const ay = BOARD_Y + actor.position.y * CELL + CELL / 2;
        const tx = BOARD_X + target.position.x * CELL + CELL / 2;
        const ty = BOARD_Y + target.position.y * CELL + CELL / 2;
        graphics.lineStyle(3, 0xf3c55e, 0.65).lineBetween(ax, ay, tx, ty);
      }
    }

    graphics.fillStyle(0x101719, 0.92).fillRoundedRect(566, 72, 374, 330, 8);
    graphics.lineStyle(2, 0x697579, 1).strokeRoundedRect(566, 72, 374, 330, 8);
    this.addLabel(588, 92, "WASTELAND // SECTOR 08-06", 21, "#93a2a7");
    this.addLabel(
      588,
      132,
      t(this.runtime.language, "phase.player"),
      22,
      "#75dafa",
    );
    this.addRoster(
      588,
      164,
      state.units.filter(({ team }) => team === "survivor"),
    );
    this.addLabel(
      588,
      272,
      t(this.runtime.language, "phase.enemy"),
      22,
      "#ff8c6f",
    );
    this.addRoster(
      588,
      304,
      state.units.filter(({ team }) => team === "raider"),
    );
  }

  private drawEffectOverlay(
    graphics: Phaser.GameObjects.Graphics,
    effect: PresentationEffect,
    progress: number,
  ): void {
    const eased = easeOutCubic(progress);
    const fromPt = cellCenter(effect.from);
    const toPt = cellCenter(effect.to);
    if (effect.kind === "attack") {
      const boltX =
        fromPt.x + (toPt.x - fromPt.x) * Math.min(1, progress * 1.6);
      const boltY =
        fromPt.y + (toPt.y - fromPt.y) * Math.min(1, progress * 1.6);
      graphics
        .lineStyle(4, 0xf3c55e, 0.85 * (1 - progress * 0.5))
        .lineBetween(fromPt.x, fromPt.y, boltX, boltY);
      graphics.fillStyle(0xfff3b0, 1).fillCircle(boltX, boltY, 6);
      graphics
        .lineStyle(4, 0xff5e49, 1 - eased * 0.7)
        .strokeCircle(toPt.x, toPt.y, 18 + eased * 18);
      if (effect.amount !== undefined) {
        const text = effect.coverMitigated
          ? `-${effect.amount} ▰`
          : `-${effect.amount}`;
        this.addLabel(
          toPt.x - 18,
          toPt.y - 26 - eased * 18,
          text,
          20,
          "#ff8e72",
        );
      }
    } else if (effect.kind === "heal") {
      graphics
        .lineStyle(4, 0x62f5a9, 1 - eased * 0.6)
        .strokeCircle(toPt.x, toPt.y, 16 + eased * 18);
      if (effect.amount !== undefined) {
        this.addLabel(
          toPt.x - 16,
          toPt.y - 26 - eased * 18,
          `+${effect.amount}`,
          20,
          "#62f5a9",
        );
      }
    }
  }

  private drawUnit(
    unit: Unit,
    legalTarget: boolean,
    effectProgress: number,
  ): void {
    if (!this.layer) return;
    const graphics = this.layer.list[0] as Phaser.GameObjects.Graphics;
    let cx = BOARD_X + unit.position.x * CELL + CELL / 2;
    let cy = BOARD_Y + unit.position.y * CELL + CELL / 2;
    const effect = this.activeEffect;
    if (
      effect &&
      effectProgress < 1 &&
      effect.kind === "move" &&
      effect.unitId === unit.id
    ) {
      const eased = easeOutCubic(effectProgress);
      const fromPt = cellCenter(effect.from);
      const toPt = cellCenter(effect.to);
      cx = fromPt.x + (toPt.x - fromPt.x) * eased;
      cy = fromPt.y + (toPt.y - fromPt.y) * eased;
    }

    const selected =
      unit.id === this.runtime.selectedId ||
      unit.id === this.runtime.activeActorId;
    const targeted = legalTarget || unit.id === this.runtime.activeTargetId;
    if (targeted) graphics.lineStyle(5, 0xff5e49, 1).strokeCircle(cx, cy, 29);
    if (selected) graphics.lineStyle(5, 0x63ddff, 1).strokeCircle(cx, cy, 31);

    const fill = unit.team === "survivor" ? 0x3b7d8c : 0x913b2b;
    const stroke = unit.team === "survivor" ? 0xbceffc : 0xffb09c;
    graphics.fillStyle(fill, 1).fillCircle(cx, cy, 24);
    graphics.lineStyle(3, stroke, 1).strokeCircle(cx, cy, 24);

    // Tactical shoulder/visor silhouette accent
    graphics
      .fillStyle(unit.team === "survivor" ? 0x75dafa : 0xff8c6f, 0.28)
      .fillRoundedRect(cx - 14, cy - 8, 28, 16, 5);

    // Mini health bar at top of token
    const hpRatio = Math.max(0, Math.min(1, unit.hp / unit.maxHp));
    graphics.fillStyle(0x0c1012, 0.85).fillRect(cx - 18, cy - 27, 36, 5);
    graphics
      .fillStyle(unit.team === "survivor" ? 0x62f5a9 : 0xff6e59, 0.95)
      .fillRect(cx - 18, cy - 27, Math.round(36 * hpRatio), 5);

    const glyph = unit.id.includes("scout")
      ? "S"
      : unit.id.includes("gunner")
        ? "G"
        : unit.id.includes("medic")
          ? "+"
          : unit.id.slice(-1).toUpperCase();
    this.addLabel(cx - 8, cy - 15, glyph, 24, "#ffffff");
    this.addLabel(cx - 29, cy + 20, `${unit.hp}♥ ${unit.ap}◆`, 20, "#ffffff");
  }

  private addRoster(x: number, y: number, units: Unit[]): void {
    units.forEach((unit, index) =>
      this.addLabel(
        x,
        y + index * 31,
        `${t(this.runtime.language, unit.nameKey as Parameters<typeof t>[1])}  ${unit.hp}/${unit.maxHp} ${t(this.runtime.language, "hp")}  ${unit.ap} ${t(this.runtime.language, "ap")}`,
        21,
        unit.id === this.runtime.selectedId ? "#f3c55e" : "#e5e8e4",
      ),
    );
  }

  private addLabel(
    x: number,
    y: number,
    text: string,
    size: number,
    color: string,
  ): void {
    const label = this.add.text(x, y, text, {
      fontFamily: "system-ui, sans-serif",
      fontSize: `${size}px`,
      color,
      fontStyle: "bold",
    });
    this.layer?.add(label);
  }
}
