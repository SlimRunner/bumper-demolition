import { math } from "../../tiny-graphics-math";

// This is not meant to be smooth, but utilitarian.

export class GimbalCamera {
  private pitchAngle: number;
  private rollAngle: number;
  private distance: number;
  private center: math.Vector3;
  private offset: math.Vector3;
  mseX?: number;
  mseY?: number;
  mouseLatch: "none" | "left" | "right" | "middle" = "none";
  sensitivity = {
    mouse: 0.02 / Math.PI,
    scroll: 1,
  };

  constructor(
    target: HTMLElement,
    initial?: {
      distance?: number;
      pitchAngle?: number;
      rollAngle?: number;
      center?: math.Vector3;
      offset?: math.Vector3;
    },
  ) {
    this.pitchAngle = initial?.pitchAngle ?? 0;
    this.rollAngle = initial?.rollAngle ?? 0;
    this.distance = initial?.distance ?? 1;
    this.center = initial?.center ?? math.vec3(0, 0, 0);
    this.offset = math.vec3(0, 0, 0);

    target.addEventListener("mousedown", (ev) => {
      switch (ev.button) {
        case 0:
          this.mouseLatch = "left";
          break;
        case 1:
          this.mouseLatch = "middle";
          break;
        case 2:
          this.mouseLatch = "right";
          break;
        default:
          this.mouseLatch = "none";
      }
    });
    document.addEventListener("mouseup", (ev) => {
      // technically wrong if the user presses multiple buttons but meh.
      this.mouseLatch = "none";
    });
    target.addEventListener("mousemove", (ev) => {
      this.mseX ??= ev.screenX;
      this.mseY ??= ev.screenY;
      const modKey = (ev.ctrlKey ? 1 : 0) | (ev.altKey ? 2 : 0);
      const below = Math.sin(this.pitchAngle) < 0;
      const flip = Math.cos(this.pitchAngle) < 0;

      if (this.mouseLatch === "left" && modKey === 0) {
        ev.preventDefault();
        const xd = (ev.screenX - this.mseX) * (flip ? -1 : 1);
        const yd = ev.screenY - this.mseY;
        this.rollAngle += xd * this.sensitivity.mouse;
        this.pitchAngle += yd * this.sensitivity.mouse;
      } else if (this.mouseLatch === "left" && modKey === 1) {
        ev.preventDefault();
        const xd = ev.screenX - this.mseX;
        const yd = (ev.screenY - this.mseY) * (below ? -1 : 1);
        const cs = Math.cos(this.rollAngle + Math.PI);
        const sn = Math.sin(this.rollAngle + Math.PI);
        const vel = this.sensitivity.mouse * this.distance * 0.25;
        this.offset[0] += (xd * sn + yd * cs) * vel;
        this.offset[2] -= (xd * cs - yd * sn) * vel;
      } else if (this.mouseLatch === "left" && modKey === 2) {
        ev.preventDefault();
        const yd = (ev.screenY - this.mseY) * (flip ? -1 : 1);
        const vel = this.sensitivity.mouse * this.distance * 0.25;
        this.offset[1] += yd * vel;
      }
      this.mseX = ev.screenX;
      this.mseY = ev.screenY;
    });
    target.addEventListener("dblclick", (ev) => {
      this.offset[0] = 0;
      this.offset[1] = 0;
      this.offset[2] = 0;
    });
    target.addEventListener("wheel", (ev) => {
      ev.preventDefault();
      const dir = Math.sign(ev.deltaY);
      if (dir != 0) {
        const vel = this.sensitivity.scroll * this.distance * 0.15;
        const dist = this.distance + dir * vel;
        if (dist > 0) {
          this.distance = dist;
        }
      }
    });
  }

  setOrigin(pos: math.Vector3) {
    this.center = pos;
  }

  getCameraTransform() {
    // reference: https://www.desmos.com/3d/uzweiuiouf
    const x1 = Math.cos(this.rollAngle);
    const z1 = Math.sin(this.rollAngle);
    const cs = Math.cos(this.pitchAngle);
    const sn = Math.sin(this.pitchAngle);
    const pos = math
      .vec3(
        this.distance * x1 * cs,
        this.distance * sn,
        this.distance * z1 * cs,
      )
      .plus(this.center)
      .plus(this.offset);
    const upAxis = cs >= 0 ? math.vec3(0, 1, 0) : math.vec3(0, -1, 0);
    return {
      cameraMatrix: math.Mat4.look_at(
        pos,
        this.center.plus(this.offset),
        upAxis,
      ),
      position: pos,
    };
  }
}
