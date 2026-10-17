type InternalBlocker =
  | "onboarding"
  | "startup"
  | "rules"
  | "result"
  | "ad"
  | "focus"
  | "visibility"
  | "portrait"
  | "mwa_intent";

interface GameplayOwnership {
  startGameplay(): void;
  stopGameplay(): void;
  startBattle(): void;
  pauseRuntime(): void;
  resumeRuntime(): void;
}

export class GameplayCoordinator {
  private readonly blockers = new Set<InternalBlocker>([
    "onboarding",
    "startup",
  ]);
  private ready = false;
  private battleStarted = false;
  private apiActive = false;
  private platformPaused = false;
  private startupPauseObserved = false;
  private startupTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly owner: GameplayOwnership) {}

  markReady(): void {
    if (this.ready) return;
    this.ready = true;
    this.startupTimer = setTimeout(() => {
      this.startupTimer = undefined;
      if (!this.startupPauseObserved) {
        this.blockers.delete("startup");
        this.reconcile();
      }
    }, 1000);
  }

  dismissOnboarding(): void {
    this.blockers.delete("onboarding");
    this.reconcile();
  }

  setPlatformPaused(paused: boolean): void {
    if (paused === this.platformPaused) return;
    this.platformPaused = paused;
    if (paused) {
      if (this.blockers.has("startup")) {
        this.startupPauseObserved = true;
        if (this.startupTimer) clearTimeout(this.startupTimer);
        this.startupTimer = undefined;
      }
      this.owner.pauseRuntime();
      this.apiActive = false;
      return;
    }
    this.owner.resumeRuntime();
    if (this.startupPauseObserved && this.blockers.has("startup"))
      this.blockers.delete("startup");
    if (!this.battleStarted) this.reconcile();
    else if (this.blockers.size === 0) this.apiActive = true;
  }

  setBlocker(
    source: Exclude<InternalBlocker, "startup" | "onboarding">,
    blocked: boolean,
  ): void {
    const changed = blocked
      ? !this.blockers.has(source)
      : this.blockers.has(source);
    if (!changed) return;
    if (blocked) this.blockers.add(source);
    else this.blockers.delete(source);
    this.reconcile();
  }

  setTerminal(terminal: boolean): void {
    this.setBlocker("result", terminal);
  }

  beginReplay(): void {
    this.blockers.delete("result");
    this.battleStarted = false;
    this.apiActive = false;
    this.reconcile();
  }

  private reconcile(): void {
    if (!this.ready || this.platformPaused) return;
    const unblocked = this.blockers.size === 0;
    if (unblocked && !this.battleStarted) {
      this.battleStarted = true;
      this.owner.startBattle();
    }
    const desired = unblocked && this.battleStarted;
    if (desired && !this.apiActive) {
      this.apiActive = true;
      this.owner.startGameplay();
    } else if (!desired && this.apiActive) {
      this.apiActive = false;
      this.owner.stopGameplay();
    }
  }
}
