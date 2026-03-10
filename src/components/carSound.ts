export class CarSound {
  private readonly audioA: HTMLAudioElement;
  private readonly audioB: HTMLAudioElement;
  private playingA = false;
  private playingB = false;
  private readonly minVolume = 0.15;
  private readonly maxVolume = 0.6;
  private readonly minRate = 0.8;
  private readonly maxRate = 2.4;
  private readonly maxSpeed: number;
  private ctx: AudioContext | null = null;
  private pannerA: StereoPannerNode | null = null;
  private pannerB: StereoPannerNode | null = null;
  private muteA = false;
  private muteB = false;

  constructor(src: string, maxSpeed = 20) {
    this.audioA = new Audio(src);
    this.audioB = new Audio(src);
    this.audioA.loop = true;
    this.audioB.loop = true;
    this.audioA.volume = 0;
    this.audioB.volume = 0;
    this.audioA.playbackRate = this.minRate;
    this.audioB.playbackRate = this.minRate;
    this.maxSpeed = Math.max(1, Math.abs(maxSpeed));
  }

  private ensureContext(): void {
    if (this.ctx?.state === "suspended") {
      this.ctx.resume();
    }
    if (this.ctx) return;
    this.ctx = new AudioContext();
    const srcA = this.ctx.createMediaElementSource(this.audioA);
    const srcB = this.ctx.createMediaElementSource(this.audioB);
    this.pannerA = this.ctx.createStereoPanner();
    this.pannerB = this.ctx.createStereoPanner();
    this.pannerA.pan.value = -1;
    this.pannerB.pan.value = 1;
    srcA.connect(this.pannerA).connect(this.ctx.destination);
    srcB.connect(this.pannerB).connect(this.ctx.destination);
  }

  setMuteA(mute: boolean): void {
    this.muteA = mute;
  }

  setMuteB(mute: boolean): void {
    this.muteB = mute;
  }

  getMuteA(): boolean {
    return this.muteA;
  }

  getMuteB(): boolean {
    return this.muteB;
  }

  update(speedA: number, speedB: number, panA = 0, panB = 0): void {
    if (this.pannerA) this.pannerA.pan.value = panA;
    if (this.pannerB) this.pannerB.pan.value = panB;
    const normA = this.normalize(speedA);
    const normB = this.normalize(speedB);
    this.applyToChannel(this.audioA, normA, "A");
    this.applyToChannel(this.audioB, normB, "B");
  }

  private normalize(speed: number): number {
    const value = Math.abs(speed) / this.maxSpeed;
    if (!isFinite(value)) {
      return 0;
    }
    if (value <= 0) {
      return 0;
    }
    if (value >= 1) {
      return 1;
    }
    return value;
  }

  private applyToChannel(
    audio: HTMLAudioElement,
    normalized: number,
    channel: "A" | "B",
  ): void {
    const muted = channel === "A" ? this.muteA : this.muteB;
    const volume = muted
      ? 0
      : this.minVolume +
        (this.maxVolume - this.minVolume) * normalized;
    const rate =
      this.minRate +
      (this.maxRate - this.minRate) * normalized;

    audio.volume = volume;
    audio.playbackRate = rate;

    const playing = channel === "A" ? this.playingA : this.playingB;
    if (!playing) {
      this.ensureContext();
      audio
        .play()
        .then(() => {
          if (channel === "A") {
            this.playingA = true;
          } else {
            this.playingB = true;
          }
        })
        .catch(() => {});
    }
  }
}
