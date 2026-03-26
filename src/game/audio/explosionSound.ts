export class ExplosionSound {
  private readonly clips: HTMLAudioElement[];
  private nextClip = 0;
  private warmed = false;
  private masterVolume = 1;

  constructor(
    src: string,
    private baseVolume = 0.75,
    private polyphony = 4,
  ) {
    const voiceCount = Math.max(1, Math.floor(polyphony));
    this.clips = Array.from({ length: voiceCount }, () => {
      const clip = new Audio(src);
      clip.preload = "auto";
      clip.load();
      clip.volume = 0;
      return clip;
    });
  }

  setMasterVolume(volume: number) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  warmup() {
    if (this.warmed || this.clips.length === 0) return;

    const clip = this.clips[0];
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
        this.warmed = true;
      })
      .catch(() => {
        clip.muted = prevMuted;
        clip.volume = prevVolume;
      });
  }

  play(volumeScale = 1, pitchJitter = 0.06) {
    if (this.clips.length === 0) return;

    const instance = this.clips[this.nextClip];
    this.nextClip = (this.nextClip + 1) % this.clips.length;

    instance.pause();
    instance.currentTime = 0;
    instance.volume = Math.min(
      1,
      this.baseVolume * this.masterVolume * volumeScale,
    );
    instance.playbackRate = 1 + (Math.random() * 2 - 1) * pitchJitter;
    instance.currentTime = 0;
    instance.play().catch(() => {});
  }
}
