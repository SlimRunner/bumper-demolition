import { clamp } from "../utils/math";
import type { PowerUpKind } from "../components/types";

type AbilitySources = Record<PowerUpKind, string[]>;

export class AbilityPickupSound {
  private readonly clips: Record<PowerUpKind, HTMLAudioElement[]>;
  private readonly nextClipIndex: Record<PowerUpKind, number>;
  private masterVolume = 1;
  private warmed = false;

  constructor(
    sources: AbilitySources,
    private baseVolume = 0.6,
    private polyphony = 3,
  ) {
    const makeVoices = (src: string) =>
      Array.from({ length: Math.max(1, Math.floor(this.polyphony)) }, () => {
        const audio = new Audio(src);
        audio.preload = "auto";
        audio.load();
        audio.volume = 0;
        return audio;
      });

    this.clips = {
      heavy: sources.heavy.flatMap(makeVoices),
      orbit: sources.orbit.flatMap(makeVoices),
    };
    this.nextClipIndex = {
      heavy: 0,
      orbit: 0,
    };
  }

  setMasterVolume(volume: number) {
    this.masterVolume = clamp(volume, 0, 1);
  }

  warmup() {
    if (this.warmed) return;

    for (const kind of ["heavy", "orbit"] as const) {
      const clip = this.clips[kind][0];
      if (!clip) continue;

      const prevMuted = clip.muted;
      const prevVolume = clip.volume;

      clip.muted = true;
      clip.volume = 0;
      clip.currentTime = 0;

      clip
        .play()
        .then(() => {
          clip.pause();
          clip.currentTime = 0;
          clip.muted = prevMuted;
          clip.volume = prevVolume;
        })
        .catch(() => {
          clip.muted = prevMuted;
          clip.volume = prevVolume;
        });
    }

    this.warmed = true;
  }

  play(kind: PowerUpKind, volumeScale = 1, pitchJitter = 0.04) {
    const variants = this.clips[kind];
    if (variants.length === 0) return;

    const clip = variants[this.nextClipIndex[kind]];
    this.nextClipIndex[kind] = (this.nextClipIndex[kind] + 1) % variants.length;

    clip.pause();
    clip.currentTime = 0;
    clip.volume = clamp(
      this.baseVolume * this.masterVolume * volumeScale,
      0,
      1,
    );
    clip.playbackRate = 1 + (Math.random() * 2 - 1) * pitchJitter;
    clip.play().catch(() => {});
  }
}
