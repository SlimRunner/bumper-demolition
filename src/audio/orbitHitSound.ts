import { clamp } from "../utils/math";

export class OrbitHitSound {
  private readonly clips: HTMLAudioElement[];
  private masterVolume = 1;
  private lastPlayTime = 0;

  constructor(
    sources: string[],
    private readonly baseVolume = 0.1,
    private readonly cooldownMs = 90,
  ) {
    this.clips = sources.map((src) => {
      const audio = new Audio(src);
      audio.preload = "auto";
      audio.load();
      audio.volume = 0;
      return audio;
    });
  }

  setMasterVolume(volume: number) {
    this.masterVolume = clamp(volume, 0, 1);
  }

  play(options?: {
    volumeScale?: number;
    pitchJitter?: number;
    volumeJitter?: number;
  }) {
    if (this.clips.length === 0) return;

    const now = Date.now();
    if (now - this.lastPlayTime < this.cooldownMs) return;

    const volumeScale = options?.volumeScale ?? 1;
    const pitchJitter = options?.pitchJitter ?? 0.07;
    const volumeJitter = options?.volumeJitter ?? 0.12;

    const clip = this.clips[Math.floor(Math.random() * this.clips.length)];
    const instance = clip.cloneNode(true) as HTMLAudioElement;

    const randomVolumeScale =
      1 + (Math.random() * 2 - 1) * Math.max(0, volumeJitter);
    const randomRate = 1 + (Math.random() * 2 - 1) * Math.max(0, pitchJitter);

    instance.volume = clamp(
      this.baseVolume * this.masterVolume * volumeScale * randomVolumeScale,
      0,
      1,
    );
    instance.playbackRate = clamp(randomRate, 0.65, 1.4);
    instance.currentTime = 0;
    instance.play().catch(() => {});

    this.lastPlayTime = now;
  }
}