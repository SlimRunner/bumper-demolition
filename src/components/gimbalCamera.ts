import { math } from "../../tiny-graphics-math";

// This is not meant to be smooth, but utilitarian.

export class GimbalCamera {
  private pitchAngle: number;
  private rollAngle: number;
  private distance: number;
  private center: math.Vector3;
  mseX?: number;
  mseY?: number;
  mouseLatch: "none" | "left" | "right" | "middle" = "none";
  sensitivity = {
    mouse: 0.02 / Math.PI,
    scroll: 1,
  };

  constructor(distance: number, target: HTMLElement) {
    this.pitchAngle = 0;
    this.rollAngle = 0;
    this.distance = distance;
    this.center = math.vec3(0, 0, 0);

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
      if (this.mouseLatch === "left") {
        ev.preventDefault();
        const xd = ev.screenX - this.mseX;
        const yd = ev.screenY - this.mseY;
        this.rollAngle += xd * this.sensitivity.mouse;
        this.pitchAngle += yd * this.sensitivity.mouse;
      } else if (this.mouseLatch === "right") {
        // move the center? how?
      }
      this.mseX = ev.screenX;
      this.mseY = ev.screenY;
    });
    target.addEventListener("wheel", (ev) => {
      ev.preventDefault();
      const dir = Math.sign(ev.deltaY);
      if (dir != 0) {
        const dist = this.distance + dir * this.sensitivity.scroll;
        if (dist > 0) {
          this.distance = dist;
        }
      }
    });
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
      .plus(this.center);
    return {
      cameraMatrix: math.Mat4.look_at(pos, this.center, math.vec3(0, 1, 0)),
      position: pos,
    };
  }
}
