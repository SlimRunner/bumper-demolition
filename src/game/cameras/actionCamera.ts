import { math } from "@tiny/tiny-graphics-math";
import { clamp, lerp } from "@/utils/math";

export class ActionCamera {
  // view orientation
  forward: math.Vector3;
  right: math.Vector3;
  up: math.Vector3;

  // camera projection params
  fovY: number;
  aspect: number;
  padding: number;

  // desired camera targets
  targetCenter: math.Vector3;
  targetDistance: number;

  // actual values (to make it smooth)
  center: math.Vector3;
  distance: number;
  centerSmooth = 6;
  zoomSmooth = 6;

  // prevent the camera going too close or too far
  minDistance = 10;
  maxDistance = 50;

  constructor(
    direction: math.Vector3,
    up = math.vec3(0, 1, 0),
    fovY = Math.PI / 4,
    aspect = 16 / 9,
  ) {
    this.forward = direction.normalized();
    this.right = this.forward.cross(up).normalized();
    this.up = this.right.cross(this.forward).normalized();

    this.fovY = fovY;
    this.aspect = aspect;

    this.padding = 2;

    this.center = math.vec3(0, 0, 0);
    this.targetCenter = this.center;

    this.distance = 8;
    this.targetDistance = 8;
  }

  setPadding(padding: number) {
    this.padding = padding;
  }

  updateTargets(subjects: math.Vector3[]) {
    if (subjects.length === 0) return;

    // the steps are
    // - (1) compute bounding box by iterating over the subjects
    // - (2) approximate camera plane using plane distances
    // - (3) compute fovs (per axis) and estimate distance

    // step (1)

    let min = subjects[0].copy();
    let max = subjects[0].copy();
    const offset = math.vec3(2, 0, 0);

    for (const p of subjects) {
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], p[i] + offset[i]);
        max[i] = Math.max(max[i], p[i] + offset[i]);
      }
    }

    const center = min.plus(max).times(0.5);
    this.targetCenter = center;

    // step (2)

    let maxX = 0;
    let maxY = 0;

    for (const p of subjects) {
      const x = p.dot(this.right);
      const y = p.dot(this.up);

      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }

    let minX = Infinity;
    let minY = Infinity;

    for (const p of subjects) {
      const x = p.dot(this.right);
      const y = p.dot(this.up);

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
    }

    const width = (maxX - minX) * 0.5;
    const height = (maxY - minY) * 0.5;

    // step (3)

    const fovX = 2 * Math.atan(Math.tan(this.fovY / 2) * this.aspect);
    const dx = width / Math.tan(fovX / 2);
    const dy = height / Math.tan(this.fovY / 2);

    let d = Math.max(dx, dy) * this.padding;
    this.targetDistance = clamp(d, this.minDistance, this.maxDistance);
  }

  updateCamera(timeDelta: number) {
    const tCenter = 1 - Math.exp(-this.centerSmooth * timeDelta);
    const tZoom = 1 - Math.exp(-this.zoomSmooth * timeDelta);

    this.center = this.center.mix(this.targetCenter, tCenter);
    this.distance = lerp(this.distance, this.targetDistance, tZoom);
  }

  getCameraTransform() {
    const position = this.center.minus(this.forward.times(this.distance));

    const cameraMatrix = math.Mat4.look_at(position, this.center, this.up);

    return {
      cameraMatrix,
      position,
    };
  }
}
