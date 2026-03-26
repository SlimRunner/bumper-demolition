import { MaterialRecord, tiny, Uniforms } from "@tiny/tiny-graphics";
import { math } from "@tiny/tiny-graphics-math";
import { range } from "@/utils/iterators";
import { lerp } from "@/utils/math";

export class SimpleGrid extends tiny.Shape {
  constructor(
    xSubs: number,
    zSubs: number,
    limits: {
      x: [number, number];
      z: [number, number];
    },
  ) {
    super("position", "normal");
    for (const x of range(xSubs)) {
      const pos = lerp(limits.x[0], limits.x[1], x / (xSubs - 1));
      this.arrays.position?.push(math.vec3(pos, 0, limits.z[0]));
      this.arrays.position?.push(math.vec3(pos, 0, limits.z[1]));
      this.arrays.normal?.push(math.vec3(0, 0, 0), math.vec3(0, 0, 0));
    }
    for (const z of range(xSubs)) {
      const pos = lerp(limits.z[0], limits.z[1], z / (xSubs - 1));
      this.arrays.position?.push(math.vec3(limits.x[0], 0, pos));
      this.arrays.position?.push(math.vec3(limits.x[1], 0, pos));
      this.arrays.normal?.push(math.vec3(0, 0, 0), math.vec3(0, 0, 0));
    }
  }

  draw(
    webgl_manager: tiny.Component,
    uniforms: Uniforms,
    model_transform: math.Mat4,
    material: MaterialRecord,
  ): void {
    super.draw(webgl_manager, uniforms, model_transform, material, "LINES");
  }
}
