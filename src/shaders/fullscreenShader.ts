import { math } from "../../tiny-graphics-math";
import {
  GPUAddresses,
  tiny,
  Uniforms,
  MaterialRecord,
} from "../../tiny-graphics";

export type screenMats = MaterialRecord & {
  color1: math.Vector4;
};

export class ScreenShader extends tiny.Shader {
  constructor() {
    super();
  }

  private shared_glsl_code() {
    return `
      precision mediump float;
    `;
  }

  vertex_glsl_code() {
    return `
      ${this.shared_glsl_code()}

      attribute vec2 texture_coord;
      attribute vec3 position;

      void main() {
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `;
  }

  fragment_glsl_code() {
    return `
      ${this.shared_glsl_code()}

      uniform vec2 resolution;
      uniform vec4 color1;

      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5) / resolution;
        gl_FragColor = color1;
      }
    `;
  }

  private send_material(
    gl: WebGL2RenderingContext,
    gpu: GPUAddresses,
    material: screenMats,
  ) {
    gl.uniform4fv(gpu.color1, material.color1);
  }

  update_GPU(
    context: WebGL2RenderingContext,
    gpu_addresses: GPUAddresses,
    _1: Uniforms,
    _2: math.Mat4,
    material: screenMats,
  ): void {
    const defaults = {
      color1: math.color(1, 1, 1, 1),
    };
    material = Object.assign({}, defaults, material);
    context.uniform2fv(gpu_addresses.resolution, [
      context.canvas.width,
      context.canvas.height,
    ]);

    this.send_material(context, gpu_addresses, material);
  }
}
