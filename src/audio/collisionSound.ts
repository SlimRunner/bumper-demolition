export class CollisionSound {
  private readonly audioSlow: HTMLAudioElement;
  private readonly audioFast: HTMLAudioElement;

  private readonly thresholdImpulse: number;
  private readonly minImpulse: number;
  private readonly maxImpulse: number;

  private readonly maxVolume: number;

  private accumulatedImpulse = 0;
  private maxImpulseSeen = 0;

  constructor(
    slowSrc: string,
    fastSrc: string,
    thresholdImpulse = 4,
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

    this.accumulatedImpulse = 0;
    this.maxImpulseSeen = 0;

    if (impulse < this.minImpulse || skip) return;

    const t = Math.min(
      1,
      (impulse - this.minImpulse) /
        (this.maxImpulse - this.minImpulse),
    );

    const volume = t * this.maxVolume;

    const audio =
      impulse >= this.thresholdImpulse
        ? this.audioFast
        : this.audioSlow;

    const instance = audio.cloneNode(true) as HTMLAudioElement;
    instance.volume = volume;
    instance.play().catch(() => {});
  }
}