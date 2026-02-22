import { ComponentLayoutOptions, tiny } from "../tiny-graphics";
import { defs } from "../examples/common";
import { math } from "../tiny-graphics-math";
import { UVShader } from "./shaders/UVShader";
import { SolidColor } from "./shaders/solidColor";
import { Axis3D } from "./shapes/axis3d";
import { GimbalCamera } from "./components/gimbalCamera";
import { SimpleGrid } from "./shapes/simpleGrid";
import { CartArmature, CartNodeNames } from "./rigging/cartArmature";
import { CartFrame } from "./physics/cartFrame";
import { MSDFrameShape } from "./shapes/msdShape";
import { range } from "./utils/iterators";
import { basisChange } from "./utils/math";

export class BumperCarsBase extends tiny.Component {
  shapes: {
    grid: SimpleGrid;
    box: defs.Cube;
    cyl: defs.Cylindrical_Tube;
    ball: defs.Subdivision_Sphere;
    disc: defs.Regular_2D_Polygon;
  };
  colors: {
    readonly red: math.Vector4;
    readonly blue: math.Vector4;
    readonly gray: math.Vector4;
    readonly softBlue: math.Vector4;
    readonly yellow: math.Vector4;
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
    solid: {
      shader: tiny.Shader;
      color: math.Vector4;
    };
  };
  armatures: {
    cartA: CartArmature;
    cartB: CartArmature;
  };
  physics: {
    cartMSD: CartFrame;
  };
  drawables: {
    axes3d: Axis3D;
    cartFrame: MSDFrameShape;
  };

  globalProps: {
    gcam?: GimbalCamera;
    animIdle: boolean;
  };

  constructor() {
    super();

    const uvShader = new UVShader();
    const phongShader = new defs.Phong_Shader();
    const solidColor = new SolidColor();

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
      solid: {
        shader: solidColor,
        color: math.vec4(0.6, 0.6, 0.6, 1),
      },
    };

    const grid = new SimpleGrid(11, 11, { x: [-5, 5], z: [-5, 5] });
    const discShape = new defs.Regular_2D_Polygon(1, 16);
    const cubeShape = new defs.Cube();
    const sphereShape = new defs.Subdivision_Sphere(4);
    const closedTube = new defs.Capped_Cylinder(1, 24, [
      [0, 2],
      [0, 1],
    ]);

    this.shapes = {
      grid: grid,
      box: cubeShape,
      cyl: closedTube,
      ball: sphereShape,
      disc: discShape,
    };

    this.colors = {
      red: math.color(0.8, 0.1, 0.1, 1),
      blue: math.color(0, 0, 1, 1),
      gray: math.color(0.6, 0.6, 0.6, 1),
      softBlue: math.color(0.176, 0.439, 0.702, 1),
      yellow: math.color(1, 1, 0, 1),
    };

    this.globalProps = {
      animIdle: false,
    };

    const cartDims = {
      wheelbase: 1.6,
      axleTrack: 1.2,
      rimSize: 0.4064,
      tireWallSize: 0.13975,
      tireWidth: 0.215,
      chassisHeight: 0.8359,
      armLinkLength: 1.25,
      armLinkRadius: 0.05,
      sawRadius: 0.3,
    };
    const cartMeshes = {
      arm1: closedTube,
      arm2: closedTube,
      chassis: cubeShape,
      saw: discShape,
      wheel: closedTube,
    };

    this.armatures = {
      cartA: new CartArmature({
        dimensions: cartDims,
        meshes: cartMeshes,
      }),
      cartB: new CartArmature({
        dimensions: cartDims,
        meshes: cartMeshes,
      }),
    };

    const cartMSD = new CartFrame({
      dimensions: {
        wheelbase: 1.6,
        axleTrack: 1.2,
        frameWidth: 0,
        frameLength: 0,
        frameHeight: 0,
      },
    });
    const cartFrame = new MSDFrameShape(
      {
        particle: {
          shape: sphereShape,
          material: {
            ...this.materials.solid,
            color: this.colors.yellow,
          },
          radius: 0.1,
        },
        beam: {
          shape: cubeShape,
          material: {
            ...this.materials.plastic,
            color: this.colors.softBlue,
          },
          radius: 0.025,
        },
      },
      cartMSD.msdSystem,
    );

    // these are NOT tiny graphic shapes, but collections of shapes.
    // Ideally only to be used as collections of actual shapes.
    const axes3d = new Axis3D({
      length: 5,
      headRatio: {
        height: 0.2,
        width: 1,
      },
    });
    this.drawables = {
      axes3d,
      cartFrame,
    };
    this.physics = {
      cartMSD,
    };
    cartMSD.enable = true;

    document.addEventListener("visibilitychange", () => {
      // this prevents the window from hanging due to the physics loop
      // (which has a fixed time delta) trying to step through a large
      // time delta. Consider it a pause sync with the browser since it
      // idles requestAnimationFrame when the window loses visibility.
      this.globalProps.animIdle = document.hidden;
    });
  }

  render_layout(div: HTMLDivElement, options?: ComponentLayoutOptions): void {
    super.render_layout(div, options);
    const canvas = this.canvas ?? document.getElementById("canvas")!;
    this.globalProps.gcam = new GimbalCamera(canvas, {
      distance: 8,
      pitchAngle: Math.PI / 8,
      rollAngle: Math.PI / 4,
    });
  }

  render_animation(context: tiny.Component): void {
    // const time = (this.uniforms.animation_time ?? 0) / 1000;

    // temporary camera for modeling
    const { cameraMatrix, position } =
      this.globalProps.gcam!.getCameraTransform();

    tiny.Shader.assign_camera(cameraMatrix, this.uniforms);

    this.uniforms.projection_transform = math.Mat4.perspective(
      Math.PI / 4,
      context.width / context.height,
      0.2,
      100,
    );

    const light_position = position.to4(1);
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
  constructor() {
    super();
  }

  render_animation(context: tiny.Component): void {
    super.render_animation(context);

    const time = (this.uniforms.animation_time ?? 0) / 1000;

    const GL = context.context!;

    const CMT = this.uniforms?.camera_transform!;
    const cam_loc = CMT.sub_block([0, 3], [3, 4]).flat();

    const cartMSD = this.physics.cartMSD;

    if (cartMSD.enable && !this.globalProps.animIdle) {
      const timeDelta = (this.uniforms.animation_delta_time ?? 0) / 1000;

      if (timeDelta > 0) {
        const timeStep = cartMSD.timeStep;
        // may miss the last target (do it manually after the loop)
        const steps = Math.floor(timeDelta / timeStep);

        for (const _ of range(steps)) {
          cartMSD.integrator.step(cartMSD.msdSystem, timeStep);
        }

        const remainder = timeDelta - steps * timeStep;
        if (remainder > 0) {
          cartMSD.integrator.step(cartMSD.msdSystem, remainder);
        }
      }
    }

    // this pattern can be used to create a sky texture later
    GL.disable(GL.DEPTH_TEST);
    this.shapes.box.draw(
      context,
      this.uniforms,
      math.Mat4.translation(cam_loc[0], cam_loc[1], cam_loc[2]),
      this.materials.uvSimple,
    );
    GL.enable(GL.DEPTH_TEST);

    // this.shapes.ball.draw(context, this.uniforms, math.Mat4.identity(), {
    //   ...this.materials.plastic,
    //   color: this.colors.red,
    // });

    const { cartA, cartB } = this.armatures;
    const { mtxCarA, mtxCarB } = cartMSD.getTransforms();

    cartA.arcs.root.traverse((joint, node, matrix) => {
      // discriminate material based on name
      const name = node.name as CartNodeNames;
      node.shape.draw(context, this.uniforms, matrix, this.materials.uvSimple);
    }, mtxCarA);
    cartB.arcs.root.traverse((joint, node, matrix) => {
      // discriminate material based on name
      const name = node.name as CartNodeNames;
      node.shape.draw(context, this.uniforms, matrix, this.materials.uvSimple);
    }, mtxCarB);

    this.shapes.grid.draw(
      context,
      this.uniforms,
      math.Mat4.identity(),
      this.materials.solid,
    );
    this.drawables.axes3d.draw(context, this.uniforms, math.Mat4.identity());
    this.drawables.cartFrame.draw(context, this.uniforms, math.Mat4.identity());
  }

  render_controls(): void {
    // minimal working example
    this.key_triggered_button("my button", ["Control", "0"], () =>
      console.log("pressed"),
    );
  }
}
