import { clamp } from "../utils/math";
import type { PowerUpKind } from "../components/types";

type AbilitySources = Record<PowerUpKind, string[]>;

export class AbilityPickupSound {
  private readonly clips: Record<PowerUpKind, HTMLAudioElement[]>;
  private masterVolume = 1;

  constructor(sources: AbilitySources, private baseVolume = 0.6) {
    this.clips = {
      heavy: sources.heavy.map((src) => {
        const audio = new Audio(src);
        audio.volume = 0;
        return audio;
      }),
      orbit: sources.orbit.map((src) => {
        const audio = new Audio(src);
        audio.volume = 0;
        return audio;
      }),
    };
  }

  setMasterVolume(volume: number) {
    this.masterVolume = clamp(volume, 0, 1);
  }

  play(kind: PowerUpKind, volumeScale = 1, pitchJitter = 0.04) {
    const variants = this.clips[kind];
    if (variants.length === 0) return;

    const clip = variants[Math.floor(Math.random() * variants.length)];
    const instance = clip.cloneNode(true) as HTMLAudioElement;

    instance.volume = clamp(
      this.baseVolume * this.masterVolume * volumeScale,
      0,
      1,
    );
    instance.playbackRate = 1 + (Math.random() * 2 - 1) * pitchJitter;
    instance.currentTime = 0;
    instance.play().catch(() => {});
  }
}