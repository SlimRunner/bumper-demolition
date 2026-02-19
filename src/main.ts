import { ComponentLayoutOptions, tiny } from "../tiny-graphics";
import { defs } from "../examples/common";
import { math } from "../tiny-graphics-math";
import { UVShader } from "./shaders/UVShader";

export class BumperCarsBase extends tiny.Component {
  render_animation(context: tiny.Component): void {
    const time = (this.uniforms.animation_time ?? 0) / 1000;

    const camLoc = math
      .vec3(Math.cos(time), Math.sin(Math.sin(time)), Math.sin(time))
      .normalized()
      .times(10);

    tiny.Shader.assign_camera(
      math.Mat4.look_at(camLoc, math.vec3(0, 0, 0), math.vec3(0, 1, 0)),
      this.uniforms,
    );

    this.uniforms.projection_transform = math.Mat4.perspective(
      Math.PI / 4,
      context.width / context.height,
      0.2,
      100,
    );

    const light_position = camLoc.to4(1);
    this.uniforms.lights = [
      defs.Phong_Shader.light_source(
        light_position,
        math.color(1, 1, 1, 1),
        1000000,
      ),
    ];
  }
}

export class BumperCars extends BumperCarsBase {
  shapes: {
    box: defs.Cube;
  };
  colors: {
    red: math.Vector4;
  };
  materials: {
    uvSimple: {
      shader: UVShader;
    };
    plastic: {
      shader: tiny.Shader;
      ambient: number;
      diffusivity: number;
      specularity: number;
      color: math.Vector4;
    };
  };

  constructor() {
    super();

    const uvShader = new UVShader();
    const phongShader = new defs.Phong_Shader();

    this.materials = {
      uvSimple: {
        shader: uvShader,
      },
      plastic: {
        shader: phongShader,
        ambient: 0.2,
        diffusivity: 1,
        specularity: 0.5,
        color: math.color(0.9, 0.5, 0.9, 1),
      },
    };

    const cubeShape = new defs.Cube();

    this.shapes = {
      box: cubeShape,
    };

    this.colors = {
      red: math.color(0.8, 0.1, 0.1, 1),
    };
  }

  render_animation(context: tiny.Component): void {
    super.render_animation(context);

    const GL = context.context!;

    const CMT = this.uniforms?.camera_transform!;
    const cam_loc = CMT.sub_block([0, 3], [3, 4]).flat();

    // this pattern can be used to create a sky texture later
    GL.disable(GL.DEPTH_TEST);
    this.shapes.box.draw(
      context,
      this.uniforms,
      math.Mat4.translation(cam_loc[0], cam_loc[1], cam_loc[2]),
      this.materials.uvSimple,
    );
    GL.enable(GL.DEPTH_TEST);

    this.shapes.box.draw(context, this.uniforms, math.Mat4.identity(), {
      ...this.materials.plastic,
      color: this.colors.red,
    });
  }

  render_controls(): void {
    // minimal working example
    this.key_triggered_button("my button", ["Control", "0"], () =>
      console.log("pressed"),
    );
  }
}
