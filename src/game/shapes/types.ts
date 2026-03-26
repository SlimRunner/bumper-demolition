import { math } from "../../tiny-graphics-math";
import { MaterialRecord, tiny, Uniforms } from "../../tiny-graphics";

export interface DrawableShape {
  draw(
    webgl_manager: tiny.Component,
    uniforms: Uniforms,
    model_transform: math.Mat4,
    material: MaterialRecord,
    type?: keyof WebGL2RenderingContext,
  ): void;
}

export interface ShapeCollection extends DrawableShape {
  foreach(
    backFn: (
      shape: DrawableShape,
      material: MaterialRecord | undefined,
      name: string,
    ) => void,
  ): void;
}
