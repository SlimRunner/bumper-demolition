import { math } from "../../tiny-graphics-math";
import {
  GPUAddresses,
  tiny,
  Uniforms,
  MaterialRecord,
} from "../../tiny-graphics";

export type uvMats = MaterialRecord & {
  color: math.Vector4;
  point_size: number;
};

export class SplatShader extends tiny.Shader {
  shared_glsl_code() {
    return `
      precision mediump float;
      varying vec4 v_color;
    `;
  }

  vertex_glsl_code() {
    return `
      ${this.shared_glsl_code()}
      attribute vec3 position;

      uniform mat4 projection_view;
      uniform mat4 model;
      uniform float point_size;
      uniform vec4 color;

      void main() {
        vec4 viewPos = model * vec4(position, 1.0);
        gl_Position = projection_view * viewPos;
        gl_PointSize = point_size / length(viewPos.xyz);
        v_color = color;
      }
    `;
  }

  fragment_glsl_code() {
    return `
      ${this.shared_glsl_code()}

      void main(){
        float dist = length(gl_PointCoord - vec2(0.5));
        if(dist > 0.5) discard;
        gl_FragColor = v_color;
      }
    `;
  }

  update_GPU(
    context: WebGL2RenderingContext,
    gpu_addresses: GPUAddresses,
    uniforms: Uniforms,
    model_transform: math.Mat4,
    material: uvMats,
  ): void {
    const defaults = {
      point_size: 100,
      color: math.color(1, 1, 1, 1),
    };
    material = Object.assign({}, defaults, material);

    const [P, C, M] = [
      uniforms.projection_transform!,
      uniforms.camera_inverse!,
      model_transform,
    ];
    const PC = P.times(C);

    context.uniformMatrix4fv(
      gpu_addresses.projection_view,
      false,
      math.Mat4.flatten_2D_to_1D(M.transposed()),
    );
    context.uniformMatrix4fv(
      gpu_addresses.model,
      false,
      math.Mat4.flatten_2D_to_1D(PC.transposed()),
    );

    context.uniform1f(gpu_addresses.point_size, material.point_size);
    context.uniform4fv(gpu_addresses.color, material.color);
  }
}
