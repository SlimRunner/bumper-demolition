export class CarSound {
  private readonly audioA: HTMLAudioElement;
  private readonly audioB: HTMLAudioElement;
  private playingA = false;
  private playingB = false;
  private readonly minVolume = 0.15;
  private readonly maxVolume = 0.6;
  private readonly minRate = 0.8;
  private readonly maxRate = 1.5;
  private readonly maxSpeed: number;

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

  update(speedA: number, speedB: number): void {
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
    const volume =
      this.minVolume +
      (this.maxVolume - this.minVolume) * normalized;
    const rate =
      this.minRate +
      (this.maxRate - this.minRate) * normalized;

    audio.volume = volume;
    audio.playbackRate = rate;

    const playing = channel === "A" ? this.playingA : this.playingB;
    if (!playing) {
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
