import { math } from "@tiny/tiny-graphics-math";
import {
  GPUAddresses,
  tiny,
  Uniforms,
  MaterialRecord,
} from "@tiny/tiny-graphics";

export type guiMats = MaterialRecord & {
  color1: math.Vector4;
  color2: math.Vector4;
  hp1: number;
  hp2: number;
};

export class ScreenGUIShader extends tiny.Shader {
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
      uniform vec4 color2;
      uniform float hp1;
      uniform float hp2;

      void main() {
        // gl_FragCoord contains the
        vec2 uv = (gl_FragCoord.xy - 0.5) / resolution;
        // vec2 pix = vec2(uv.x, uv.y)
        // float cross_threshold = cross_hair(uv, 2.0, 10.0);
        if (gl_FragCoord.x < 500.0) {
          gl_FragColor = color1;
        } else {
          discard;
        }
      }
    `;
  }

  private send_uniforms(
    gl: WebGL2RenderingContext,
    gpu: GPUAddresses,
    uniforms: Uniforms,
    model_transform: math.Mat4,
  ): void {
    gl.uniformMatrix4fv(
      gpu.projection,
      false,
      math.Matrix.flatten_2D_to_1D(
        uniforms.projection_transform?.transposed()!,
      ),
    );
    gl.uniformMatrix4fv(
      gpu.view,
      false,
      math.Matrix.flatten_2D_to_1D(uniforms.camera_inverse?.transposed()!),
    );
    gl.uniformMatrix4fv(
      gpu.model,
      false,
      math.Matrix.flatten_2D_to_1D(model_transform.transposed()),
    );
  }

  private send_material(
    gl: WebGL2RenderingContext,
    gpu: GPUAddresses,
    material: guiMats,
  ) {
    gl.uniform4fv(gpu.color1, material.color1);
    gl.uniform4fv(gpu.color2, material.color2);
    gl.uniform1f(gpu.hp1, material.hp1);
    gl.uniform1f(gpu.hp2, material.hp2);
  }

  update_GPU(
    context: WebGL2RenderingContext,
    gpu_addresses: GPUAddresses,
    uniforms: Uniforms,
    model_transform: math.Mat4,
    material: guiMats,
  ): void {
    const defaults = {
      fg_color: math.color(1, 1, 1, 1),
      bg_color: math.color(0, 0, 0, 1),
    };
    material = Object.assign({}, defaults, material);
    context.uniform2fv(gpu_addresses.resolution, [
      context.canvas.width,
      context.canvas.height,
    ]);

    this.send_material(context, gpu_addresses, material);
    this.send_uniforms(context, gpu_addresses, uniforms, model_transform);
  }
}
