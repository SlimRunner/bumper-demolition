export class ExplosionSound {
  private readonly clip: HTMLAudioElement;
  private masterVolume = 1;

  constructor(src: string, private baseVolume = 0.75) {
    this.clip = new Audio(src);
    this.clip.volume = 0;
  }

  setMasterVolume(volume: number) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  play(volumeScale = 1, pitchJitter = 0.06) {
    const instance = this.clip.cloneNode(true) as HTMLAudioElement;
    instance.volume = Math.min(
      1,
      this.baseVolume * this.masterVolume * volumeScale,
    );
    instance.playbackRate = 1 + (Math.random() * 2 - 1) * pitchJitter;
    instance.currentTime = 0;
    instance.play().catch(() => {});
  }
}
