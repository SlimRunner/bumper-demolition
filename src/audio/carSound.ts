import { clamp } from "../utils/math";
import { math } from "../../tiny-graphics-math";
import { CarName } from "../components/types";
import { enumerate } from "../utils/iterators";

export class CarSound {
  private readonly audio: HTMLAudioElement[];
  private readonly currentRate: [number, number];
  private readonly currentVolume: [number, number];
  private readonly playing = [false, false];
  private readonly muted = [false, false];
  private readonly panners: (StereoPannerNode | null)[] = [null, null];

  private ctx: AudioContext | null = null;
  private paused = false;

  private readonly minVolume = 0.2;
  private readonly maxVolume = 0.6;

  private readonly minRate = 0.8;
  private readonly maxRate = 2.5;

  constructor(
    src: string,
    private readonly maxSpeed = 10,
    private readonly maxThrust = 240,
  ) {
    this.audio = [new Audio(src), new Audio(src)];
    this.currentRate = [1, 1];
    this.currentVolume = [1, 1];

    for (const a of this.audio) {
      a.loop = true;
      a.volume = 0;
      a.playbackRate = this.minRate;
      a.preservesPitch = false;
    }

    this.maxSpeed = Math.max(1, Math.abs(maxSpeed));
  }

  private carIndex(car: CarName): number {
    return car === "carA" ? 0 : 1;
  }

  private ensureContext(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();

      for (let i = 0; i < 2; i++) {
        const src = this.ctx.createMediaElementSource(this.audio[i]);
        const panner = this.ctx.createStereoPanner();

        this.panners[i] = panner;
        src.connect(panner).connect(this.ctx.destination);
      }
    }

    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  setMute(car: CarName, mute: boolean) {
    this.muted[this.carIndex(car)] = mute;
  }

  getMute(car: CarName) {
    return this.muted[this.carIndex(car)];
  }

  get paused2() {
    return this.paused;
  }

  setPaused(paused: boolean) {
    this.paused = paused;

    if (paused) {
      for (const a of this.audio) {
        a.volume = 0;
      }
    }
  }

  update(state: {
    carA: { speed: number; thrust: number; pos: math.Vector3 };
    carB: { speed: number; thrust: number; pos: math.Vector3 };
    camera: { pos: math.Vector3; right: math.Vector3 };
  }): void {
    const iters: Array<[number, CarName]> = [
      [
        CarSound.computePan(
          state.carA.pos,
          state.camera.pos,
          state.camera.right,
        ),
        "carA",
      ],
      [
        CarSound.computePan(
          state.carB.pos,
          state.camera.pos,
          state.camera.right,
        ),
        "carB",
      ],
    ];

    const normalize = (v: number, max: number) => {
      return clamp(Math.abs(v) / max, 0, 1);
    };

    for (const [i, [pan, carname]] of enumerate(iters)) {
      const normSpeed = normalize(state[carname].speed, this.maxSpeed);
      const normThrust = normalize(state[carname].thrust, this.maxThrust);

      this.apply(i, normSpeed, normThrust, pan);
    }
  }

  static computePan(
    carPos: math.Vector3,
    camPos: math.Vector3,
    camRight: math.Vector3,
  ): number {
    const toCar = carPos.minus(camPos);
    const dist = Math.max(toCar.norm(), 0.001);
    return -clamp(toCar.dot(camRight) / dist, -1, 1);
  }

  private apply(i: number, speedNorm: number, thrustNorm: number, pan: number) {
    if (this.paused) return;

    if (this.panners[i]) {
      this.panners[i]!.pan.value = pan;
    }

    const audio = this.audio[i];

    const targetVolume = this.muted[i]
      ? 0
      : this.minVolume + (this.maxVolume - this.minVolume) * thrustNorm;

    const smoothing = 0.15;
    const targetRate = this.minRate + (this.maxRate - this.minRate) * speedNorm;
    this.currentRate[i] += (targetRate - this.currentRate[i]) * smoothing;
    this.currentVolume[i] += (targetVolume - this.currentVolume[i]) * smoothing;

    audio.volume = clamp(this.currentVolume[i], this.minVolume, this.maxVolume);
    audio.playbackRate = clamp(this.currentRate[i], this.minRate, this.maxRate);

    if (!this.playing[i]) {
      this.ensureContext();

      audio
        .play()
        .then(() => {
          this.playing[i] = true;
        })
        .catch(() => {});
    }
  }
}
