import { clamp } from "@/utils/math";
import { math } from "@tiny/tiny-graphics-math";
import { CarName } from "@/components/types";
import { enumerate } from "@/utils/iterators";
import { AudioSystem } from "@/audio/audioSystem";

export class CarSound {
  // audio[car][sound] = [idle, half, full]
  private readonly audio: HTMLAudioElement[][];
  private readonly currentRate: [number, number];
  private readonly currentThrust: [number, number];
  private readonly playing = [false, false];
  private readonly muted = [false, false];
  private readonly desynced: [boolean[], boolean[]] = [
    [false, false, false],
    [false, false, false],
  ];
  private readonly panners: (StereoPannerNode | null)[] = [null, null];

  private ctx: AudioContext | null = null;
  private paused = false;

  private readonly volume = 0.2;
  private masterVolume = 1;

  private readonly minVolume = 0.2 * this.volume;
  private readonly maxVolume = 0.6 * this.volume;

  private readonly minRate = 1;
  private readonly maxRate = 2;
  private readonly maxDesyncOffset = 2; // seconds

  constructor(
    private audioSystem: AudioSystem,
    idleSrc: string,
    halfSrc: string,
    fullSrc: string,
    private readonly maxSpeed = 10,
    private readonly maxThrust = 240,
  ) {
    this.audio = [
      [new Audio(idleSrc), new Audio(halfSrc), new Audio(fullSrc)],
      [new Audio(idleSrc), new Audio(halfSrc), new Audio(fullSrc)],
    ];
    this.currentRate = [1, 1];
    this.currentThrust = [0, 0];

    for (const carAudio of this.audio) {
      for (const a of carAudio) {
        a.preload = "auto";
        a.load();
        a.loop = true;
        a.volume = 0;
        a.playbackRate = this.minRate;
        a.preservesPitch = false;
      }
    }

    this.maxSpeed = Math.max(1, Math.abs(maxSpeed));
  }

  private carIndex(car: CarName): number {
    return car === "carA" ? 0 : 1;
  }

  private ensureContext(): void {
    const ctx = this.audioSystem.ctx;

    for (let car = 0; car < 2; car++) {
      if (!this.panners[car]) {
        const panner = this.audioSystem.createPanner();
        this.panners[car] = panner;

        for (let sound = 0; sound < 3; sound++) {
          const src = ctx.createMediaElementSource(this.audio[car][sound]);
          src.connect(panner);
        }
      }
    }

    if (ctx.state === "suspended") {
      void ctx.resume();
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
      for (const carAudio of this.audio) {
        for (const a of carAudio) {
          a.volume = 0;
        }
      }
    }
  }

  setMasterVolume(volume: number) {
    this.masterVolume = clamp(volume, 0, 1);
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

    // Smooth thrust value
    this.currentThrust[i] += (thrustNorm - this.currentThrust[i]) * 0.15;
    const thrust = this.currentThrust[i];

    // Calculate blend volumes for each sound based on thrust
    let idleVolume = 0;
    let halfVolume = 0;
    let fullVolume = 0;

    if (thrust < 0.5) {
      // Blend between idle and half throttle
      const blend = thrust / 0.5;
      idleVolume = 1 - blend;
      halfVolume = blend;
    } else {
      // Blend between half and full throttle
      const blend = (thrust - 0.5) / 0.5;
      halfVolume = 1 - blend;
      fullVolume = blend;
    }

    // Calculate overall volume based on thrust
    const baseVolume = this.muted[i]
      ? 0
      : (this.minVolume + (this.maxVolume - this.minVolume) * thrust) *
        this.masterVolume;

    // Update pitch based on speed
    const smoothing = 0.15;
    const targetRate = this.minRate + (this.maxRate - this.minRate) * speedNorm;
    this.currentRate[i] += (targetRate - this.currentRate[i]) * smoothing;

    // Apply volume and pitch to all three sounds
    const sounds: Array<[HTMLAudioElement, number, number]> = [
      [this.audio[i][0], idleVolume, 0], // idle
      [this.audio[i][1], halfVolume, 1], // half
      [this.audio[i][2], fullVolume, 2], // full
    ];

    for (const [audio, blendVolume, soundIdx] of sounds) {
      const finalVolume = baseVolume * blendVolume;
      audio.volume = clamp(finalVolume, 0, this.maxVolume);
      audio.playbackRate = clamp(
        this.currentRate[i],
        this.minRate,
        this.maxRate,
      );

      if (!this.playing[i] && audio.paused) {
        this.ensureContext();

        // Desync on first play - offset each sound by a random amount
        if (!this.desynced[i][soundIdx]) {
          audio.currentTime = Math.random() * this.maxDesyncOffset;
          this.desynced[i][soundIdx] = true;
        }

        audio
          .play()
          .then(() => {
            this.playing[i] = true;
          })
          .catch(() => {});
      }
    }
  }
}
