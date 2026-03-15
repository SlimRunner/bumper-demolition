import { clamp } from "../utils/math";
import { math } from "../../tiny-graphics-math"

export function computePan(
  objPos: math.Vector3,
  camPos: math.Vector3,
  camRight: math.Vector3
): number {
  const toObj = objPos.minus(camPos);
  const dist = Math.max(toObj.norm(), 0.001);
  return -clamp(toObj.dot(camRight) / dist, -1, 1);
}

export class AudioSystem {
  readonly ctx = new AudioContext();
  readonly master = this.ctx.createGain();

  constructor() {
    this.master.connect(this.ctx.destination);
  }

  async resume() {
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  createPanner() {
    const p = this.ctx.createStereoPanner();
    p.connect(this.master);
    return p;
  }

  createSource(audio: HTMLAudioElement) {
    const p = this.ctx.createMediaElementSource(audio);
    p.connect(this.master);
    return p;
  }
}

export class SpatialSound {
  private audio: HTMLAudioElement;
  private panner: StereoPannerNode;
  private gain: GainNode;

  constructor(private audioSystem: AudioSystem, src: string) {
    this.audio = new Audio(src);
    this.audio.loop = true; // good for continuous sounds like blades

    const ctx = audioSystem.ctx;

    const srcNode = ctx.createMediaElementSource(this.audio);
    this.gain = ctx.createGain();
    this.panner = audioSystem.createPanner();

    srcNode.connect(this.gain);
    this.gain.connect(this.panner);
  }

  set preservesPitch(flag: boolean) {
    this.audio.preservesPitch = flag;
  }

  play(volume = 1) {
    const ctx = this.audioSystem.ctx;

    this.audio.currentTime = 0;
    this.audio.play().catch(()=>{});

    this.gain.gain.cancelScheduledValues(ctx.currentTime);
    this.gain.gain.setValueAtTime(0, ctx.currentTime);
    this.gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.05);
  }

  stop() {
    const ctx = this.audioSystem.ctx;

    const t = ctx.currentTime;

    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setValueAtTime(this.gain.gain.value, t);
    this.gain.gain.linearRampToValueAtTime(0, t + 0.2);

    setTimeout(() => {
      this.audio.pause();
      this.audio.currentTime = 0;
    }, 200);
  }

  setVolume(v: number) {
    const ctx = this.audioSystem.ctx;
    this.gain.gain.linearRampToValueAtTime(v, ctx.currentTime + 0.05);
  }

  setRate(r: number) {
    this.audio.playbackRate = r;
  }

  setPan(v: number) {
    this.panner.pan.value = v;
  }
}
