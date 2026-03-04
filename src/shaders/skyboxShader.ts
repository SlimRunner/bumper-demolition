import { math } from "../../tiny-graphics-math";
import {
  GPUAddresses,
  tiny,
  Uniforms,
  MaterialRecord,
} from "../../tiny-graphics";
import {
  get_shared_skybox_model,
  get_vertex_skybox_model,
  get_fragment_skybox_model,
} from "./skyboxStrings";

export type skyboxMats = MaterialRecord & {
  sun_zenith: number;
  sun_azimuth: number;
};

export class SkyboxWH extends tiny.Shader {
  constructor() {
    super();
  }

  shared_glsl_code() {
    return get_shared_skybox_model();
  }

  vertex_glsl_code() {
    return this.shared_glsl_code() + get_vertex_skybox_model();
  }

  fragment_glsl_code() {
    return this.shared_glsl_code() + get_fragment_skybox_model();
  }

  private send_material(
    gl: WebGL2RenderingContext,
    gpu: GPUAddresses,
    material: skyboxMats,
  ) {
    gl.uniform2fv(
      gpu.sun_dir,
      math.Vector.create(material.sun_zenith, material.sun_azimuth),
    );
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

  update_GPU(
    context: WebGL2RenderingContext,
    gpu_addresses: GPUAddresses,
    uniforms: Uniforms,
    model_transform: math.Mat4,
    material: skyboxMats,
  ): void {
    const defaults = {
      sun_azimuth: 0,
      sun_zenith: 0,
    };
    material = Object.assign({}, defaults, material);

    this.send_material(context, gpu_addresses, material);
    this.send_uniforms(context, gpu_addresses, uniforms, model_transform);
  }
}
