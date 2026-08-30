import type { BattleEvent } from "../core/types";
import type { BattleSession } from "./battle-session";
import type { PlatformService } from "./index";

interface AudioControl {
  pause(): void;
  resume(): void;
}

export class RuntimeLifecycle {
  inputEnabled = true;
  private readonly pauseSources = new Set<string>();
  private readonly queue: BattleEvent[] = [];
  private readonly unsubscribe: () => void;

  constructor(
    platform: PlatformService,
    private readonly session: BattleSession,
    private readonly audio: AudioControl,
  ) {
    this.unsubscribe = platform.subscribeLifecycle((event) => {
      this.setPaused("platform", event === "pause");
    });
  }

  enqueue(events: readonly BattleEvent[]): void {
    this.queue.push(...events);
  }
  takeNext(): BattleEvent | undefined {
    return this.isPaused ? undefined : this.queue.shift();
  }
  get pendingCount(): number {
    return this.queue.length;
  }
  get isPaused(): boolean {
    return this.pauseSources.size > 0;
  }

  setPaused(source: string, paused: boolean): void {
    const wasPaused = this.isPaused;
    if (paused) this.pauseSources.add(source);
    else this.pauseSources.delete(source);
    if (wasPaused === this.isPaused) return;
    this.inputEnabled = !this.isPaused;
    if (this.isPaused) {
      this.session.pause();
      this.audio.pause();
    } else {
      this.session.resume();
      this.audio.resume();
    }
  }

  destroy(): void {
    this.unsubscribe();
  }
}
