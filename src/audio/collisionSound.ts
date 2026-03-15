export class CollisionSound {
  private readonly audioSlow: HTMLAudioElement;
  private readonly audioFast: HTMLAudioElement;

  private readonly thresholdImpulse: number;
  private readonly minImpulse: number;
  private readonly maxImpulse: number;

  private readonly maxVolume: number;

  private accumulatedImpulse = 0;
  private maxImpulseSeen = 0;
  private lastPlayTime = 0;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly flushDelay = 50;

  constructor(
    slowSrc: string,
    fastSrc: string,
    thresholdImpulse = 5,
    minImpulse = 0.8,
    maxImpulse = 7,
    maxVolume = 0.6,
  ) {
    this.audioSlow = new Audio(slowSrc);
    this.audioFast = new Audio(fastSrc);

    this.audioSlow.volume = 0;
    this.audioFast.volume = 0;

    this.thresholdImpulse = thresholdImpulse;
    this.minImpulse = minImpulse;
    this.maxImpulse = maxImpulse;
    this.maxVolume = maxVolume;
  }

  accumulate(impulse: number) {
    this.accumulatedImpulse += impulse;
    this.maxImpulseSeen = Math.max(this.maxImpulseSeen, impulse);
  }

  flush(skip = false) {
    // const impulse = this.maxImpulseSeen; // alternative
    const impulse = Math.sqrt(this.accumulatedImpulse);

    if (impulse < this.minImpulse || skip) {
      this.accumulatedImpulse = 0;
      this.maxImpulseSeen = 0;
      return;
    }

    // If a timer is already pending, just keep accumulating
    if (this.flushTimer !== null) {
      return;
    }

    // Start a new timer to flush after delay
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.playSound();
    }, this.flushDelay);
  }

  private playSound() {
    const impulse = Math.sqrt(this.accumulatedImpulse);

    this.accumulatedImpulse = 0;
    this.maxImpulseSeen = 0;

    if (impulse < this.minImpulse) return;

    // Check if 300ms has passed since last sound
    const now = Date.now();
    if (now - this.lastPlayTime < 300) return;

    const t = Math.min(
      1,
      (impulse - this.minImpulse) / (this.maxImpulse - this.minImpulse),
    );

    const volume = t * this.maxVolume;

    const audio =
      impulse >= this.thresholdImpulse ? this.audioFast : this.audioSlow;

    const instance = audio.cloneNode(true) as HTMLAudioElement;
    instance.volume = volume;
    instance.play().catch(() => {});

    this.lastPlayTime = now;
  }
}
