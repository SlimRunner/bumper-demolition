import { ComponentProps, tiny } from "../tiny-graphics";
import { math } from "../tiny-graphics-math";

export namespace defs {
  export class Minimal_Webgl_Demo extends tiny.Component {
    shapes: Record<string, tiny.Shape>;
    shader: Record<string, tiny.Shader>;
  }

  export class Movement_Controls extends tiny.Component {
    roll: number;
    look_around_locked: boolean;
    thrust: math.Vector3;
    pos: math.Vector3;
    z_axis: math.Vector3;
    radians_per_frame: number;
    meters_per_frame: number;
    speed_multiplier: number;
    mouse_enabled_canvases: Set<HTMLCanvasElement>;
    will_take_over_uniforms: boolean;
    mouse: {
      from_center: math.Vector<2>;
      anchor?: math.Vector<2>;
    };

    matrix: () => math.Mat4;
    inverse: () => math.Mat4;

    constructor(props: ComponentProps);

    set_recipient(
      matrix_closure: () => math.Mat4,
      inverse_closure: () => math.Mat4,
    ): void;
    reset(): void;
    add_mouse_controls(canvas: HTMLCanvasElement): void;
    render_explanation(
      document_builder: tiny.Component,
      document_element?: HTMLDivElement,
    ): void;
    render_controls(): void;
    first_person_flyaround(
      radians_per_frame: number,
      meters_per_frame: number,
      leeway?: number,
    ): void;
    third_person_arcball(radians_per_frame: number): void;
    render_animation(caller: tiny.Component): void;
  }
}
