import { SpringDamperSystem } from "../physics/msdSystem";
import { tiny, Uniforms, MaterialRecord } from "../../tiny-graphics";
import { math } from "../../tiny-graphics-math";
import type { DrawableShape } from "./types";

export class MSDFrameShape implements DrawableShape {
  private _msd?: SpringDamperSystem;
  particle: {
    shape: tiny.Shape;
    material: MaterialRecord;
    radius: number;
    type?: keyof WebGL2RenderingContext;
  };
  beam: {
    shape: tiny.Shape;
    material: MaterialRecord;
    radius: number;
    type?: keyof WebGL2RenderingContext;
  };

  constructor(
    props: {
      particle: {
        shape: tiny.Shape;
        material: MaterialRecord;
        radius: number;
        type?: keyof WebGL2RenderingContext;
      };
      beam: {
        shape: tiny.Shape;
        material: MaterialRecord;
        radius: number;
        type?: keyof WebGL2RenderingContext;
      };
    },
    msdSystem?: SpringDamperSystem,
  ) {
    this._msd = msdSystem;
    props.particle.type ??= "TRIANGLES";
    props.beam.type ??= "TRIANGLES";
    this.particle = props.particle;
    this.beam = props.beam;
  }

  draw(
    webgl_manager: tiny.Component,
    uniforms: Uniforms,
    model_transform: math.Mat4,
  ): void {
    if (this._msd) {
      const rp = this.particle.radius;
      for (const particle of this._msd.particles.container) {
        const [x, y, z] = particle.location;
        const transform = new math.Mat4(
          [rp, 0, 0, x],
          [0, rp, 0, y],
          [0, 0, rp, z],
          [0, 0, 0, 1],
        );
        this.particle.shape.draw(
          webgl_manager,
          uniforms,
          model_transform.times(transform),
          this.particle.material,
          this.particle.type,
        );
      }

      const rb = this.beam.radius;
      for (const [_, [p1, p2]] of this._msd.links) {
        const dir = p2.location.minus(p1.location);
        const dirNorm = dir.normalized();
        let mainAxis = math.vec3(0, 0, 1);
        let rotAxis = mainAxis.cross(dirNorm);
        if (rotAxis.norm() < 0.1) {
          mainAxis = math.vec3(0, 1, 0);
          rotAxis = mainAxis.cross(dir);
        }
        const dist = dir.norm();
        const [xs, ys, zs] = mainAxis
          .times(dist / 2)
          .map((n) => (n === 0 ? rb : n));
        const [xr, yr, zr] = rotAxis.normalized();
        const angle = Math.acos(mainAxis.dot(dirNorm));
        const [xc, yc, zc] = p1.location.plus(p2.location).times(0.5);

        const matrix = math.Mat4.translation(xc, yc, zc);
        matrix.post_multiply(math.Mat4.rotation(angle, xr, yr, zr));
        matrix.post_multiply(math.Mat4.scale(xs, ys, zs));

        this.beam.shape.draw(
          webgl_manager,
          uniforms,
          model_transform.times(matrix),
          this.beam.material,
          this.beam.type,
        );
      }
    }
  }
}
