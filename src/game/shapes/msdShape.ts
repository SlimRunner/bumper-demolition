import { SpringDamperSystem } from "@/physics/msdSystem";
import { tiny, Uniforms, MaterialRecord } from "@tiny/tiny-graphics";
import { math } from "@tiny/tiny-graphics-math";
import type { DrawableShape } from "@/shapes/types";
import { ParticleShape } from "@/shapes/particleShape";

export class MSDFrameShape implements DrawableShape {
  private _msd?: SpringDamperSystem;
  particle: {
    shape: tiny.Shape;
    material: MaterialRecord;
    radius: number;
    type?: keyof WebGL2RenderingContext;
  };
  beam: {
    shape: ParticleShape;
    material: MaterialRecord;
    radius: number;
    type: keyof WebGL2RenderingContext;
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
        // shape: tiny.Shape;
        material: MaterialRecord;
        radius: number;
      };
    },
    msdSystem?: SpringDamperSystem,
  ) {
    this._msd = msdSystem;
    props.particle.type ??= "TRIANGLES";
    this.particle = props.particle;
    const springCount = msdSystem?.springs.container.length ?? 0;
    this.beam = {
      ...props.beam,
      type: "LINES",
      shape: new ParticleShape(springCount * 2),
    };
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

      webgl_manager.context?.lineWidth(this.beam.radius);
      this.beam.shape.clearParticles();
      for (const [_, [p1, p2]] of this._msd.links) {
        this.beam.shape.addParticles(p1.location);
        this.beam.shape.addParticles(p2.location);
      }

      this.beam.shape.draw(
        webgl_manager,
        uniforms,
        model_transform,
        this.beam.material,
        this.beam.type,
      );
      webgl_manager.context?.lineWidth(1);
    }
  }
}
