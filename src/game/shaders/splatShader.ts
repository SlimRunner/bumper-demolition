import { math } from "@tiny/tiny-graphics-math";
import {
  GPUAddresses,
  tiny,
  Uniforms,
  MaterialRecord,
} from "@tiny/tiny-graphics";

export type splatMats = MaterialRecord & {
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

      float smoothstep(float t) {
        float t2 = t * t;
        return 3.0 * t2 - 2.0 * t2 * t;
      }

      void main() {
          vec2 p = gl_PointCoord - vec2(0.5);
          float dist = length(p);

          if (dist > 0.5) discard;

          float t = dist * 2.0; // 0 center -> 1 edge

          // soft alpha falloff
          float alpha = smoothstep(1.0, 0.0, t);

          // whiten the core
          float core = smoothstep(0.5, 0.0, t);
          vec3 color = mix(v_color.rgb, vec3(1.0), core);
          gl_FragColor = vec4(color, alpha * v_color.a);
      }
    `;
  }

  update_GPU(
    context: WebGL2RenderingContext,
    gpu_addresses: GPUAddresses,
    uniforms: Uniforms,
    model_transform: math.Mat4,
    material: splatMats,
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
