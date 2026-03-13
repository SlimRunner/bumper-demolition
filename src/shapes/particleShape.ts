import { math } from "../../tiny-graphics-math";
import {
  GPUAddresses,
  tiny,
  Uniforms,
  MaterialRecord,
} from "../../tiny-graphics";

export class ParticleShape extends tiny.Shape {
  max: number;
  count: number;

  constructor(max_particles: number) {
    super("position");

    this.max = max_particles;

    this.arrays.position = [];
    for (let i = 0; i < max_particles; i++)
      this.arrays.position.push(math.vec3(0, 0, 0));

    this.count = 0;
  }

  clearParticles() {
    this.count = 0;
  }

  addParticles(particle: math.Vector3) {
    const i = this.count;
    if (i >= this.max) return false;
    this.count += 1;
    this.arrays.position![i][0] = particle[0];
    this.arrays.position![i][1] = particle[1];
    this.arrays.position![i][2] = particle[2];
    return true;
  }

  setParticles(particles: math.Vector3[]) {
    this.count = Math.min(particles.length, this.max);

    for (let i = 0; i < this.count; i++) {
      const p = particles[i];
      this.arrays.position![i][0] = p[0];
      this.arrays.position![i][1] = p[1];
      this.arrays.position![i][2] = p[2];
    }
  }

  draw(
    webgl_manager: tiny.Component,
    uniforms: Uniforms,
    model_transform: math.Mat4,
    material: MaterialRecord,
  ): void {
    const GL = webgl_manager.context!;
    this.copy_onto_graphics_card(GL, ["position"], false);

    material.shader!.activate(
      GL,
      this.gpu_instances.get(GL)?.webGL_buffer_pointers!,
      uniforms,
      model_transform,
      material,
    );

    GL.drawArrays(GL.POINTS, 0, this.count);
  }
}
