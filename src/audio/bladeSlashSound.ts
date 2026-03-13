export class BladeSlashSound {
  private readonly clips: HTMLAudioElement[];

  constructor(...sources: string[]) {
    this.clips = sources.map((src) => {
      const a = new Audio(src);
      a.volume = 1;
      return a;
    });
  }

  play(): void {
    if (this.clips.length === 0) return;
    const i = Math.floor(Math.random() * this.clips.length);
    const clip = this.clips[i];
    clip.currentTime = 0;
    clip.play().catch(() => {});
  }
}
