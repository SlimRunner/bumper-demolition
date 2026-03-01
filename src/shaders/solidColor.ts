import { math } from "../../tiny-graphics-math";
import {
  GPUAddresses,
  tiny,
  Uniforms,
  MaterialRecord,
} from "../../tiny-graphics";

export type uvMats = MaterialRecord & {
  color: math.Vector4;
};

export class SolidColor extends tiny.Shader {
  constructor() {
    super();
  }

  private shared_glsl_code() {
    return `precision mediump float;`;
  }

  vertex_glsl_code() {
    return `
      ${this.shared_glsl_code()}
      attribute vec3 position;

      uniform mat4 projection;
      uniform mat4 view;
      uniform mat4 model;

      void main() {
        vec4 p4 = vec4(position, 1.0);
        // determine view space p4
        mat4 modelViewMatrix = view * model;
        vec4 viewModelPosition = modelViewMatrix * p4;

        // determine final 3D position
        gl_Position = projection * viewModelPosition;
      }
    `;
  }

  fragment_glsl_code() {
    return `
      ${this.shared_glsl_code()}
      uniform vec4 color;

      void main() {
        gl_FragColor = color;
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
    material: uvMats,
  ) {
    gl.uniform4f(
      gpu.color,
      material.color[0],
      material.color[1],
      material.color[2],
      material.color[3],
    );
  }

  update_GPU(
    context: WebGL2RenderingContext,
    gpu_addresses: GPUAddresses,
    uniforms: Uniforms,
    model_transform: math.Mat4,
    material: uvMats,
  ): void {
    // it does not need defaults but here you would add them
    const defaults = {
      color: math.color(0, 0, 0, 1),
    };
    material = Object.assign({}, defaults, material);

    this.send_material(context, gpu_addresses, material);
    this.send_uniforms(context, gpu_addresses, uniforms, model_transform);
  }
}
