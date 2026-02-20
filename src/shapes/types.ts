import { math } from "../../tiny-graphics-math";
import { tiny, Uniforms } from "../../tiny-graphics";
import type { Material } from "../shaders/types";

export interface DrawableShape {
  draw(
    webgl_manager: tiny.Component,
    uniforms: Uniforms,
    model_transform: math.Mat4,
    material: Material,
    type?: keyof WebGL2RenderingContext,
  ): void;
}
