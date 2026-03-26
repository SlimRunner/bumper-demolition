import { GPUAddresses, MaterialRecord, tiny, Uniforms } from "../tiny-graphics";
import { math } from "../tiny-graphics-math";

export interface LightSource {
  position: math.Vector4;
  color: math.Vector4;
  attenuation: number;
}

export interface FlatPhongMaterial extends MaterialRecord {
  color: math.Vector4;
  ambient: number;
  diffusivity: number;
  specularity: number;
  smoothness: number;
}

export namespace defs {
  export class Basic_Shader extends tiny.Shader {}

  export class Funny_Shader extends tiny.Shader {}

  export class Phong_Shader extends tiny.Shader {
    num_lights: number;

    constructor(num_lights?: number);

    static light_source(
      position: math.Vector4,
      color: math.Vector4,
      size: number,
    ): LightSource;
    send_material(
      gl: WebGL2RenderingContext,
      gpu: GPUAddresses,
      material: FlatPhongMaterial,
    ): void;
    send_uniforms(
      gl: WebGL2RenderingContext,
      gpu: GPUAddresses,
      uniforms: Uniforms,
      model_transform: math.Mat4,
    ): void;
    update_GPU(
      context: WebGL2RenderingContext,
      gpu_addresses: GPUAddresses,
      uniforms: Uniforms,
      model_transform: math.Mat4,
      material: FlatPhongMaterial,
    ): void;
  }

  export class Textured_Phong extends Phong_Shader {}

  export class Fake_Bump_Map extends Textured_Phong {}
}
