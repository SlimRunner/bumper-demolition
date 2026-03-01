import { math } from "../../tiny-graphics-math";
import { GPUAddresses, tiny, Uniforms } from "../../tiny-graphics";

export class UVShader extends tiny.Shader {
  constructor() {
    super();
  }

  private shared_glsl_code() {
    // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
    return `
      precision mediump float;

      varying vec3 vViewPosition;
      varying vec3 uvs;

      float mapRange(float value, float minValue, float maxValue, float newMinValue, float newMaxValue) {
        return mix(newMinValue, newMaxValue, (value - minValue) / (maxValue - minValue));
      }
    `;
  }

  vertex_glsl_code() {
    // ********* VERTEX SHADER *********
    return `
      ${this.shared_glsl_code()}
      attribute vec3 position, normal;

      uniform mat4 projection;
      uniform mat4 view;
      uniform mat4 model;

      void main() {
        uvs.x = mapRange(normal.x,-1.0,1.0,0.0,1.0);
        uvs.y = mapRange(normal.y,-1.0,1.0,0.0,1.0);
        uvs.z = mapRange(normal.z,0.0,-1.0,0.5,1.0);
        // uvs = normal;
        vec4 p4 = vec4(position, 1.0);
        //determine view space p4
        mat4 modelViewMatrix = view * model;
        vec4 viewModelPosition = modelViewMatrix * p4;

        //pass varyings to fragment shader
        vViewPosition = viewModelPosition.xyz;

        //determine final 3D position
        gl_Position = projection * viewModelPosition;
      }
    `;
  }

  fragment_glsl_code() {
    // ********* FRAGMENT SHADER *********
    return `
      ${this.shared_glsl_code()}

      void main() {
        gl_FragColor = vec4(uvs, 1.0);
      }
    `;
  }

  private send_uniforms(
    gl: WebGL2RenderingContext,
    gpu: GPUAddresses,
    uniforms: Uniforms,
    model_transform: math.Mat4,
  ): void {
    // NOTE the ?. and ! below
    //
    // these assert that the properties are technically nullable but
    // tiny graphics "weakly" guarantees that they are not at these
    // stage, but a mistake on your part may cause it to happen. Thus
    // knowing that they are not you assert they are not nullable with !

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

  update_GPU(
    context: WebGL2RenderingContext,
    gpu_addresses: GPUAddresses,
    uniforms: Uniforms,
    model_transform: math.Mat4,
    material: any,
  ): void {
    // it does not need defaults but here you would add them
    // const defaults = {
    //   color: math.color(0, 0, 0, 1),
    // };
    // material = Object.assign({}, defaults, material);

    // this.send_material(context, gpu_addresses, material);
    this.send_uniforms(context, gpu_addresses, uniforms, model_transform);
  }
}
