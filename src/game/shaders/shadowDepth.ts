import { math } from "@tiny/tiny-graphics-math";
import { GPUAddresses, tiny, Uniforms } from "@tiny/tiny-graphics";

type ShadowUniforms = Uniforms & {
  light_view?: math.Mat4;
  light_projection?: math.Mat4;
};

export class ShadowDepthShader extends tiny.Shader {
  vertex_glsl_code(): string {
    return `
      precision highp float;
      attribute vec3 position;

      uniform mat4 model_transform;
      uniform mat4 light_view;
      uniform mat4 light_projection;

      void main() {
        gl_Position = light_projection * light_view * model_transform * vec4(position, 1.0);
      }
    `;
  }

  fragment_glsl_code(): string {
    return `
      precision highp float;
      void main() {
      }
    `;
  }

  update_GPU(
    context: WebGL2RenderingContext,
    gpu_addresses: GPUAddresses,
    uniforms: ShadowUniforms,
    model_transform: math.Mat4,
  ): void {
    const lightView = uniforms.light_view ?? math.Mat4.identity();
    const lightProjection = uniforms.light_projection ?? math.Mat4.identity();

    context.uniformMatrix4fv(
      gpu_addresses.model_transform,
      false,
      math.Matrix.flatten_2D_to_1D(model_transform.transposed()),
    );
    context.uniformMatrix4fv(
      gpu_addresses.light_view,
      false,
      math.Matrix.flatten_2D_to_1D(lightView.transposed()),
    );
    context.uniformMatrix4fv(
      gpu_addresses.light_projection,
      false,
      math.Matrix.flatten_2D_to_1D(lightProjection.transposed()),
    );
  }
}
