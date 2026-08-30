export type ReadinessPart = "platform" | "scene" | "dom" | "overlays" | "input";

export class ReadinessCoordinator {
  private readonly complete = new Set<ReadinessPart>();
  private emitted = false;
  failure: { part: ReadinessPart; messageKey: string } | null = null;

  constructor(
    private readonly emitGameLoaded: () => void,
    private readonly notifyPlatformReady: () => void,
  ) {}

  mark(part: ReadinessPart): void {
    this.complete.add(part);
    this.flush();
  }

  fail(part: ReadinessPart, messageKey: string): void {
    if (!this.emitted && !this.failure) this.failure = { part, messageKey };
  }

  get isInteractive(): boolean {
    return this.emitted;
  }

  private flush(): void {
    if (this.emitted || this.failure || this.complete.size !== 5) return;
    try {
      this.notifyPlatformReady();
    } catch {
      this.failure = {
        part: "platform",
        messageKey: "startup.platformFailed",
      };
      return;
    }
    this.emitGameLoaded();
    this.emitted = true;
  }
}
