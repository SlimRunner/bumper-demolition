export class MusicPlayer {
  private audio: HTMLAudioElement;

  constructor(src: string) {
    this.audio = new Audio(src);
    this.audio.loop = true;
  }

  play() {
    this.audio.play().catch(()=>{});
  }

  stop() {
    this.audio.pause();
  }

  setVolume(v: number) {
    this.audio.volume = v;
  }
}
