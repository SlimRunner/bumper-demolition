import { math } from "@tiny/tiny-graphics-math";
import { MaterialRecord, tiny, Uniforms } from "@tiny/tiny-graphics";
import { vecTransform } from "@/utils/math";
import type { DrawableShape } from "@/shapes/types";
import { SolidColor } from "@/shaders/solidColor";

export type ArrowProps = {
  length: number;
  headRatio: {
    width: number;
    height: number;
  };
};

class AxisArrow extends tiny.Shape {
  constructor(
    private color: math.Vector4,
    props: Partial<ArrowProps>,
    transform?: math.Mat4 | number[][],
  ) {
    super("position", "normal");
    const {
      length: len,
      headRatio: { width: w, height: h },
    } = {
      length: 1,
      headRatio: {
        height: 0.2,
        width: 0.2,
      },
      ...props,
    };
    transform = transform ?? math.Mat4.identity();

    // reference: https://www.desmos.com/3d/sjo0cza4kn
    const positions = [
      [0, 0, 0, 0],
      [len, 0, 0, 0],
      [(1 - h) * len, 0, (len * h * w) / 2, 0],
      [(1 - h) * len, 0, (-len * h * w) / 2, 0],
      [len, 0, 0, 0],
    ].map((v) => vecTransform(transform, v));

    for (const [x, y, z] of positions) {
      this.arrays.position?.push(math.vec3(x, y, z));
      this.arrays.normal?.push(math.vec3(0, 0, 0));
    }
  }

  draw(
    webgl_manager: tiny.Component,
    uniforms: Uniforms,
    model_transform: math.Mat4,
    material: MaterialRecord,
    type?: keyof WebGL2RenderingContext,
  ): void {
    super.draw(
      webgl_manager,
      uniforms,
      model_transform,
      {
        ...material,
        color: this.color,
      },
      type,
    );
  }
}

export class Axis3D implements DrawableShape {
  private _axes: {
    x: AxisArrow;
    y: AxisArrow;
    z: AxisArrow;
  };
  private _mat: MaterialRecord;

  constructor(props: Partial<ArrowProps>) {
    this._axes = {
      x: new AxisArrow(math.color(1, 0, 0, 1), props),
      y: new AxisArrow(math.color(0, 1, 0, 1), props, [
        [0, 1, 0, 0],
        [1, 0, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ]),
      z: new AxisArrow(math.color(0, 0, 1, 1), props, [
        [0, 0, 1, 0],
        [0, 1, 0, 0],
        [1, 0, 0, 0],
        [0, 0, 0, 1],
      ]),
    };
    this._mat = {
      shader: new SolidColor(),
    };
  }

  draw(
    webgl_manager: tiny.Component,
    uniforms: Uniforms,
    model_transform: math.Mat4,
  ): void {
    this._axes.x.draw(
      webgl_manager,
      uniforms,
      model_transform,
      this._mat,
      "LINE_STRIP",
    );
    this._axes.y.draw(
      webgl_manager,
      uniforms,
      model_transform,
      this._mat,
      "LINE_STRIP",
    );
    this._axes.z.draw(
      webgl_manager,
      uniforms,
      model_transform,
      this._mat,
      "LINE_STRIP",
    );
  }
}
