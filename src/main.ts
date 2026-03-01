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
import { basisChange, clamp, lerp, smoothstep } from "./utils/math";
import { FileMesh } from "./shapes/fileMesh";

export class BumperCarsBase extends tiny.Component {
  shapes: {
    grid: SimpleGrid;
    box: defs.Cube;
    cyl: defs.Cylindrical_Tube;
    ball: defs.Subdivision_Sphere;
    disc: defs.Regular_2D_Polygon;
    tire: tiny.Shape;
  };
  colors: {
    readonly red: math.Vector4;
    readonly blue: math.Vector4;
    readonly gray: math.Vector4;
    readonly softBlue: math.Vector4;
    readonly yellow: math.Vector4;
    readonly white: math.Vector4;
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
    isIdling: boolean;
    timeMultiplier: number;
    cameraPin: "detached" | "carA" | "carB";
  };

  constructor() {
    super();

    this.colors = {
      red: math.color(0.8, 0.1, 0.1, 1),
      blue: math.color(0, 0, 1, 1),
      gray: math.color(0.6, 0.6, 0.6, 1),
      softBlue: math.color(0.176, 0.439, 0.702, 1),
      yellow: math.color(1, 1, 0, 1),
      white: math.color(1, 1, 1, 1),
    };

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

    const grid = new SimpleGrid(51, 51, { x: [-25, 25], z: [-25, 25] });
    const discShape = new defs.Regular_2D_Polygon(1, 5);
    const cubeShape = new defs.Cube();
    const sphereShape = new defs.Subdivision_Sphere(4);
    const closedTube = new defs.Capped_Cylinder(1, 24, [
      [0, 2],
      [0, 1],
    ]);
    const tireMesh = new FileMesh("../assets/meshes/crappy-tire.obj");

    this.shapes = {
      grid: grid,
      box: cubeShape,
      cyl: closedTube,
      ball: sphereShape,
      disc: discShape,
      tire: tireMesh,
    };

    this.globalProps = {
      isIdling: false,
      timeMultiplier: 1,
      cameraPin: "detached",
    };

    const cartDims = {
      chassisWidth: 1.2,
      chassisLength: 1.6 + (0.13975 + 0.4064) * 1.5,
      chassisHeight: 0.8359,
      floorClearance: (0.13975 + 0.4064) / 3,

      wheelbase: 1.6,
      axleTrack: 1.2,

      rimSize: 0.4064,
      tireWallSize: 0.13975,
      tireWidth: 0.215,

      armLinkLength: 1.25,
      armLinkRadius: 0.05,
      sawRadius: 0.3,
    };
    const cartMeshes = {
      arm1: closedTube,
      arm2: closedTube,
      chassis: cubeShape,
      saw: discShape,
      wheel: tireMesh,
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
        frameWidth: cartDims.axleTrack,
        frameLength: cartDims.chassisLength,
        frameHeight: cartDims.chassisHeight + cartDims.floorClearance,
        wheelbase: cartDims.wheelbase,
      },
      transforms: {
        cartA: math.Mat4.translation(0, 0, 6).times(
          math.Mat4.rotation(Math.PI / 2, 0, 1, 0),
        ),
        cartB: math.Mat4.translation(-5, 0, -2).times(
          math.Mat4.rotation(0, 0, 1, 0),
        ),
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
    cartMSD.enable = false;

    document.addEventListener("visibilitychange", () => {
      // this prevents the window from hanging due to the physics loop
      // (which has a fixed time delta) trying to step through a large
      // time delta. Consider it a pause sync with the browser since it
      // idles requestAnimationFrame when the window loses visibility.
      this.globalProps.isIdling = document.hidden;
    });
  }

  protected resetGame() {
    // this is just one function right now but keep it because we may
    // need to reset other things later.
    this.physics.cartMSD.resetState();
    this.armatures.cartA.resetState();
    this.armatures.cartB.resetState();
  }

  render_layout(div: HTMLDivElement, options?: ComponentLayoutOptions): void {
    super.render_layout(div, options);

    // even if you remove the camera leave this in. We can leverage it
    // to add a gui with CSS.
    const canvas = this.canvas ?? document.getElementById("canvas")!;

    this.globalProps.gcam = new GimbalCamera(canvas, {
      distance: 8,
      pitchAngle: Math.PI / 8,
      rollAngle: 0,
      center: math.vec3(0, 0, 0),
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
    const { cartA, cartB } = this.armatures;

    // do all time related operations inside this if statement
    if (cartMSD.enable && !this.globalProps.isIdling) {
      const timeDelta = (this.uniforms.animation_delta_time ?? 0) / 1000;
      const timeMult = this.globalProps.timeMultiplier;

      cartA.updateControls(timeDelta * timeMult);
      cartB.updateControls(timeDelta * timeMult);
      const tires = cartMSD.updateTireVectors(
        cartA.steerAngle,
        cartA.thrustForce,
        cartB.steerAngle,
        cartB.thrustForce,
      );

      if (timeDelta > 0) {
        const timeStep = cartMSD.timeStep;
        // may miss the last target (done manually after the loop)
        const steps = Math.floor(timeDelta / timeStep);

        for (const _ of range(steps)) {
          cartMSD.integrator.step(cartMSD.msdSystem, timeStep * timeMult);
        }

        const remainder = timeDelta - steps * timeStep;
        if (remainder > 0) {
          cartMSD.integrator.step(cartMSD.msdSystem, remainder * timeMult);
        }
      }

      const groundSpeeds = this.physics.cartMSD.getTireGroundSpeed();
      cartA.updateTires(groundSpeeds.CarA, timeDelta * timeMult);
      cartB.updateTires(groundSpeeds.CarB, timeDelta * timeMult);
      cartA.updateFrontWheels(tires.CarA.frontLeft, tires.CarA.frontRight);
      cartB.updateFrontWheels(tires.CarB.frontLeft, tires.CarB.frontRight);
      cartA.updateArm(timeDelta * timeMult);
      cartB.updateArm(timeDelta * timeMult);
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

    const { mtxCarA, mtxCarB } = cartMSD.getTransforms();
    const carAPos = math.vec3(mtxCarA[0][3], mtxCarA[1][3], mtxCarA[2][3]);
    const carBPos = math.vec3(mtxCarB[0][3], mtxCarB[1][3], mtxCarB[2][3]);

    switch (this.globalProps.cameraPin) {
      case "detached":
        break;
      case "carA":
        this.globalProps.gcam?.setOrigin(carAPos);
        break;
      case "carB":
        this.globalProps.gcam?.setOrigin(carBPos);
        break;
    }

    cartA.arcs.root.traverse((joint, node, matrix) => {
      // can discriminate material based on name
      const name = node.name as CartNodeNames;
      node.shape.draw(context, this.uniforms, matrix, this.materials.uvSimple);
    }, mtxCarA);
    cartB.arcs.root.traverse((joint, node, matrix) => {
      // can discriminate material based on name
      const name = node.name as CartNodeNames;
      node.shape.draw(context, this.uniforms, matrix, this.materials.uvSimple);
    }, mtxCarB);

    // TODO: remove grid when arena is added
    this.shapes.grid.draw(
      context,
      this.uniforms,
      math.Mat4.identity(),
      this.materials.solid,
    );

    // TODO: remove axis when arena is added
    this.drawables.axes3d.draw(context, this.uniforms, math.Mat4.identity());
    // TODO: remove frame rending on finished game
    this.drawables.cartFrame.draw(context, this.uniforms, math.Mat4.identity());
  }

  render_controls(): void {
    // controls for car A
    this.live_string((elem) => {
      elem.textContent = "Car A";
    });
    this.key_triggered_button(
      "accelerate",
      ["w"],
      () => {
        this.armatures.cartA.thrustForce = 40;
      },
      undefined,
      () => {
        this.armatures.cartA.thrustForce = 0;
      },
    );
    this.key_triggered_button(
      "brake",
      ["s"],
      () => {
        this.armatures.cartA.thrustForce = -40;
      },
      undefined,
      () => {
        this.armatures.cartA.thrustForce = 0;
      },
    );
    this.key_triggered_button(
      "steer left",
      ["a"],
      () => {
        this.armatures.cartA.steerTarget = -1;
      },
      undefined,
      () => {
        this.armatures.cartA.steerTarget = 0;
      },
    );
    this.key_triggered_button(
      "steer right",
      ["d"],
      () => {
        this.armatures.cartA.steerTarget = 1;
      },
      undefined,
      () => {
        this.armatures.cartA.steerTarget = 0;
      },
    );
    this.key_triggered_button("swing blade", ["e"], () => {
      // TODO: remove setBladeStatus once power-up system is implemented
      this.armatures.cartA.setBladeStatus(true);
      this.armatures.cartA.swingArm();
    });
    this.new_line();

    // controls for car B
    this.live_string((elem) => {
      elem.textContent = "Car B";
    });
    this.key_triggered_button(
      "accelerate",
      ["8"],
      () => {
        this.armatures.cartB.thrustForce = 40;
      },
      undefined,
      () => {
        this.armatures.cartB.thrustForce = 0;
      },
    );
    this.key_triggered_button(
      "brake",
      ["5"],
      () => {
        this.armatures.cartB.thrustForce = -40;
      },
      undefined,
      () => {
        this.armatures.cartB.thrustForce = 0;
      },
    );
    this.key_triggered_button(
      "steer left",
      ["4"],
      () => {
        this.armatures.cartB.steerTarget = -1;
      },
      undefined,
      () => {
        this.armatures.cartB.steerTarget = 0;
      },
    );
    this.key_triggered_button(
      "steer right",
      ["6"],
      () => {
        this.armatures.cartB.steerTarget = 1;
      },
      undefined,
      () => {
        this.armatures.cartB.steerTarget = 0;
      },
    );
    this.key_triggered_button("swing blade", ["7"], () => {
      // TODO: remove setBladeStatus once power-up system is implemented
      this.armatures.cartB.setBladeStatus(true);
      this.armatures.cartB.swingArm();
    });
    this.new_line();

    // other shortcuts
    this.key_triggered_button("toggle physics", ["p"], () => {
      this.physics.cartMSD.enable = !this.physics.cartMSD.enable;
    });
    this.new_line();
    this.key_triggered_button("normal speed", ["v"], () => {
      this.globalProps.timeMultiplier = 1;
    });
    this.key_triggered_button("2x slow-mo", ["b"], () => {
      this.globalProps.timeMultiplier = 1 / 2;
    });
    this.new_line();
    this.key_triggered_button("10x slow-mo", ["n"], () => {
      this.globalProps.timeMultiplier = 1 / 10;
    });
    this.key_triggered_button("100x slow-mo", ["m"], () => {
      this.globalProps.timeMultiplier = 1 / 100;
    });
    this.new_line();
    this.key_triggered_button("toggle camera", ["c"], () => {
      switch (this.globalProps.cameraPin) {
        case "detached":
          this.globalProps.cameraPin = "carA";
          break;
        case "carA":
          this.globalProps.cameraPin = "carB";
          break;
        case "carB":
          this.globalProps.cameraPin = "detached";
          break;
      }
    });
    this.live_string((elem) => {
      elem.style.paddingLeft = "20px";
      elem.textContent = `status: ${this.globalProps.cameraPin}`;
    });
    this.new_line();
    this.key_triggered_button("reset", ["t"], () => {
      this.resetGame();
    });
  }
}
