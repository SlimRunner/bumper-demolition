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
import { ActionCamera } from "./components/actionCamera";
import { ComplexTextured, CplxMats } from "./shaders/complexTexture";
import { SkyboxWH } from "./shaders/skyboxShader";
import { GameGUI } from "./components/gameGui";
import {
  calculateSunPosition,
  getAverageSkyColor,
  getGrayscale,
  getSunColor,
} from "./shaders/skyboxUtils";
import { DrawableShape, ShapeCollection } from "./shapes/types";

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
    readonly white: math.Vector4;
    sumAmbient: math.Vector4;
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
    asphalt: {
      shader: ComplexTextured;
    } & CplxMats;
    skybox: {
      shader: SkyboxWH;
      sun_zenith: number;
      sun_azimuth: number;
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
    tire: ShapeCollection;
    sawBlade: ShapeCollection;
    saw_arm1: ShapeCollection;
    saw_arm2: ShapeCollection;
    arenaWalls: ShapeCollection;
    arenaFloor: ShapeCollection;
  };

  gameView: {
    gimbalCam?: GimbalCamera;
    actionCam?: ActionCamera;
    aspectRatio: number;
    fov: number;
    cameraPin: "detached" | "carA" | "carB" | "follow";
  };

  globalProps: {
    isIdling: boolean;
    timeMultiplier: number;
    showMeshes: boolean;
  };

  gui?: GameGUI;

  constructor() {
    super();

    this.colors = {
      red: math.color(0.8, 0.1, 0.1, 1),
      blue: math.color(0, 0, 1, 1),
      gray: math.color(0.6, 0.6, 0.6, 1),
      softBlue: math.color(0.176, 0.439, 0.702, 1),
      yellow: math.color(1, 1, 0, 1),
      white: math.color(1, 1, 1, 1),
      sumAmbient: math.color(0, 0, 0, 0),
    };

    const uvShader = new UVShader();
    const phongShader = new defs.Phong_Shader(5);
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
      asphalt: {
        shader: new ComplexTextured(5),
        ambient: 0.4,
        diffusivity: 4,
        specularity: 1,
        bumpiness: 2,
        ambient_color: math.color(0.5, 0.5, 0.5, 1),
        texture: new tiny.Texture(
          "../assets/textures/asphalt/color_map.jpg",
          "LINEAR_MIPMAP_LINEAR",
        ),
        spec_map: new tiny.Texture(
          "../assets/textures/asphalt/spec_map.jpg",
          "LINEAR_MIPMAP_LINEAR",
        ),
        bump_map: new tiny.Texture(
          "../assets/textures/asphalt/normal_map.jpg",
          "LINEAR_MIPMAP_LINEAR",
        ),
      },
      skybox: {
        shader: new SkyboxWH(),
        sun_azimuth: Math.PI * 0.4,
        sun_zenith: Math.PI * 0.35,
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
    const tireMesh = new FileMesh(
      "../assets/meshes/TireMesh_1.obj",
      math.Mat4.scale(3.49, 3.49, 3.49),
    ); //3.7 tires
    const chasisMeshRed = new FileMesh(
      "../assets/meshes/CarChasis_Red.obj",
      math.Mat4.translation(0.261, 0, 0).times(
        math.Mat4.scale(0.559, 1.218, 1.152),
      ),
    );
    const chasisMeshBlue = new FileMesh(
      "../assets/meshes/CarChasis_Blue.obj",
      math.Mat4.translation(0.261, 0, 0).times(
        math.Mat4.scale(0.559, 1.218, 1.152),
      ),
    );
    const sawMesh = new FileMesh(
      "../assets/meshes/Sawblade_2.obj",
      math.Mat4.scale(0.62, 0.62, 0.62),
    );
    const saw_arm1_mesh = new FileMesh(
      "../assets/meshes/SawArm1_1.obj",
      math.Mat4.translation(0, 0, -0.495).times(
        math.Mat4.scale(1.208, 1.208, 0.0789),
      ),
    );
    const saw_arm2_mesh = new FileMesh(
      "../assets/meshes/SawArm2_1.obj",
      math.Mat4.translation(0, 0, -0.495).times(
        math.Mat4.scale(1.208, 1.208, 0.0789),
      ),
    );
    const arenaFloor = new FileMesh(
      "../assets/meshes/capsule-shape-arena-floor.obj",
      math.Mat4.rotation(Math.PI / 2, 0, 1, 0),
      math.Vector.create(2, 2),
    );
    const arenaWalls = new FileMesh(
      "../assets/meshes/capsule-shape-arena-walls.obj",
      math.Mat4.rotation(Math.PI / 2, 0, 1, 0),
    );

    this.shapes = {
      grid: grid,
      box: cubeShape,
      cyl: closedTube,
      ball: sphereShape,
      disc: discShape,
    };

    this.gameView = {
      aspectRatio: 16 / 9,
      fov: Math.PI / 4,
      cameraPin: "follow",
    };

    this.globalProps = {
      isIdling: false,
      timeMultiplier: 1,
      showMeshes: true,
    };

    const cartDims = {
      chassisWidth: 1.2,
      chassisLength: 1.2 + (0.13975 + 0.4064) * 1.5,
      chassisHeight: 0.8359,
      floorClearance: 0.25,

      wheelbase: 1.2,
      axleTrack: 1.0,

      rimSize: 0.3,
      tireWallSize: 0.14,
      tireWidth: 0.2,

      armLinkLength: 1.1,
      armLinkRadius: 0.06,
      sawRadius: 0.3,
    };
    const cartMeshesA = {
      arm1: saw_arm1_mesh,
      arm2: saw_arm2_mesh,
      chassis: chasisMeshRed,
      saw: sawMesh,
      wheel: tireMesh,
    };
    const cartMeshesB = {
      arm1: saw_arm1_mesh,
      arm2: saw_arm2_mesh,
      chassis: chasisMeshBlue,
      saw: sawMesh,
      wheel: tireMesh,
    };

    this.armatures = {
      cartA: new CartArmature({
        dimensions: cartDims,
        meshes: cartMeshesA,
      }),
      cartB: new CartArmature({
        dimensions: cartDims,
        meshes: cartMeshesB,
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
          math.Mat4.rotation(-Math.PI / 2, 0, 1, 0),
        ),
        cartB: math.Mat4.translation(0, 0, -6).times(
          math.Mat4.rotation(Math.PI / 2, 0, 1, 0),
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
            ...this.materials.solid,
            color: this.colors.softBlue,
          },
          radius: 0.015,
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
      tire: tireMesh,
      sawBlade: sawMesh,
      saw_arm1: saw_arm1_mesh,
      saw_arm2: saw_arm2_mesh,
      arenaFloor,
      arenaWalls,
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
    this.gui?.resetState();
  }

  render_layout(div: HTMLDivElement, options?: ComponentLayoutOptions): void {
    super.render_layout(div, options);

    // even if you remove the camera leave this in. We can leverage it
    // to add a gui with CSS.
    const canvas = this.canvas ?? document.getElementById("canvas")!;
    this.gui = new GameGUI(canvas as HTMLElement);

    const fov = (Math.PI * 60) / 180;
    const aspectRatio = this.width / this.height;
    this.gameView = {
      gimbalCam: new GimbalCamera(canvas, {
        distance: 8,
        pitchAngle: Math.PI / 8,
        rollAngle: 0,
        center: math.vec3(0, 0, 0),
      }),
      actionCam: new ActionCamera(
        math.vec3(-1, -0.71, 0),
        math.vec3(0, 1, 0),
        fov,
        aspectRatio,
      ),
      aspectRatio,
      fov,
      cameraPin: "follow",
    };

    if (!this.gui) {
      this.gui = new GameGUI(canvas);
    }
    this.gui.resetState();
  }

  render_animation(context: tiny.Component): void {
    const time = (this.uniforms.animation_time ?? 0) / 1000;
    const timeDelta = (this.uniforms.animation_delta_time ?? 0) / 1000;

    this.gameView.actionCam!.updateCamera(timeDelta);

    const { cameraMatrix, position } =
      this.gameView.cameraPin === "follow"
        ? this.gameView.actionCam!.getCameraTransform()
        : this.gameView.gimbalCam!.getCameraTransform();

    tiny.Shader.assign_camera(cameraMatrix, this.uniforms);

    this.uniforms.projection_transform = math.Mat4.perspective(
      this.gameView.fov,
      this.gameView.aspectRatio,
      0.2,
      100,
    );

    const { sun_azimuth, sun_zenith } = calculateSunPosition(
      lerp(4, 18, clamp(this.gui!.currentTime / 360, 0, 1)),
      0.3,
      6,
    );
    const sunColor = getSunColor({ sun_azimuth, sun_zenith });
    this.colors.sumAmbient = getAverageSkyColor({ sun_azimuth, sun_zenith });

    this.materials.asphalt.ambient_color = this.colors.sumAmbient;

    const sunLuminance = getGrayscale(sunColor);
    this.materials.skybox.sun_azimuth = sun_azimuth;
    this.materials.skybox.sun_zenith = sun_zenith;
    const light_dir = math.vec4(
      10 * Math.sin(sun_zenith) * Math.cos(sun_azimuth),
      10 * Math.cos(sun_zenith),
      10 * Math.sin(sun_zenith) * Math.sin(sun_azimuth),
      0,
    );
    this.uniforms.lights = [
      defs.Phong_Shader.light_source(light_dir, sunColor, 50),
    ];
    for (const [x, z] of [
      [-1, -1],
      [-1, 1],
      [1, 1],
      [1, -1],
    ]) {
      this.uniforms.lights.push(
        defs.Phong_Shader.light_source(
          math.vec4(x * 15, 10, z * 15, 1),
          math.color(1, 1, 1, 1),
          70 * (1 - sunLuminance),
        ),
      );
    }
  }
}

export class BumperCars extends BumperCarsBase {
  private guiHealth = {
    carA: 100,
    carB: 100,
  };

  private guiPower: {
    carA: "heavy" | "orbit" | "none";
    carB: "heavy" | "orbit" | "none";
  } = {
    carA: "none",
    carB: "none",
  };

  constructor() {
    super();
  }

  protected resetGame(): void {
    super.resetGame();
    this.guiHealth.carA = 100;
    this.guiHealth.carB = 100;
    this.guiPower.carA = "none";
    this.guiPower.carB = "none";
  }

  private applyGuiDamage(target: "carA" | "carB", damage: number): void {
    const next = clamp(this.guiHealth[target] - damage, 0, 100);
    this.guiHealth[target] = next;
    this.gui?.updateHealth(this.guiHealth.carA, this.guiHealth.carB);
  }

  private setGuiPower(
    target: "carA" | "carB",
    power: "heavy" | "orbit" | "none",
  ): void {
    this.guiPower[target] = power;
    this.gui?.setPowerUp(this.guiPower.carA, this.guiPower.carB);
  }

  render_animation(context: tiny.Component): void {
    super.render_animation(context);

    // accumulates all the subjects that need to be inside the frame
    const camSubjects: math.Vector3[] = [];

    const time = (this.uniforms.animation_time ?? 0) / 1000;
    const timeDelta = (this.uniforms.animation_delta_time ?? 0) / 1000;

    const GL = context.context!;

    const CMT = this.uniforms?.camera_transform!;
    const cam_loc = CMT.sub_block([0, 3], [3, 4]).flat();

    const cartMSD = this.physics.cartMSD;
    const { cartA, cartB } = this.armatures;

    // do all time related oerations inside this if statement
    if (cartMSD.enable && !this.globalProps.isIdling) {
      const timeMult = this.globalProps.timeMultiplier;

      this.gui?.updateTimer(timeDelta * timeMult);
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
      this.materials.skybox,
    );
    GL.enable(GL.DEPTH_TEST);

    this.drawables.arenaFloor.draw(
      context,
      this.uniforms,
      math.Mat4.identity(),
      this.materials.asphalt,
    );
    this.drawables.arenaWalls.draw(
      context,
      this.uniforms,
      math.Mat4.identity(),
      this.materials.uvSimple,
    );

    const { mtxCarA, mtxCarB } = cartMSD.getTransforms();
    const carAPos = math.vec3(mtxCarA[0][3], mtxCarA[1][3], mtxCarA[2][3]);
    const carBPos = math.vec3(mtxCarB[0][3], mtxCarB[1][3], mtxCarB[2][3]);
    camSubjects.push(carAPos, carBPos);

    switch (this.gameView.cameraPin) {
      case "follow":
      case "detached":
        break;
      case "carA":
        this.gameView.gimbalCam?.setOrigin(carAPos);
        break;
      case "carB":
        this.gameView.gimbalCam?.setOrigin(carBPos);
        break;
    }

    if (this.globalProps.showMeshes) {
      cartA.arcs.root.traverse((joint, node, matrix) => {
        const name = node.name as CartNodeNames;
        if (node.shape instanceof FileMesh) {
          node.shape.foreach((shape, mat, name) => {
            shape.draw(
              context,
              this.uniforms,
              matrix,
              mat ?? this.materials.uvSimple,
            );
          });
        } else {
          node.shape.draw(
            context,
            this.uniforms,
            matrix,
            this.materials.uvSimple,
          );
        }
      }, mtxCarA);
      cartB.arcs.root.traverse((joint, node, matrix) => {
        const name = node.name as CartNodeNames;
        if (node.shape instanceof FileMesh) {
          node.shape.foreach((shape, mat, name) => {
            shape.draw(
              context,
              this.uniforms,
              matrix,
              mat ?? this.materials.uvSimple,
            );
          });
        } else {
          node.shape.draw(
            context,
            this.uniforms,
            matrix,
            this.materials.uvSimple,
          );
        }
      }, mtxCarB);
    } else {
      // TODO: remove frame rending on finished game
      this.drawables.cartFrame.draw(
        context,
        this.uniforms,
        math.Mat4.identity(),
      );
    }

    // do this at the very end always
    this.gameView.actionCam!.updateTargets(camSubjects);
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
        this.armatures.cartA.thrustForce = 120;
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
        this.armatures.cartA.thrustForce = -120;
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
        this.armatures.cartB.thrustForce = 120;
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
        this.armatures.cartB.thrustForce = -120;
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

    // GUI debug shortcuts
    this.live_string((elem) => {
      elem.textContent = "GUI Debug";
    });
    this.key_triggered_button("A heavy power", ["u"], () => {
      this.setGuiPower("carA", "heavy");
      this.gui?.showMessage("Car A picked up Heavy");
    });
    this.key_triggered_button("B heavy power", ["i"], () => {
      this.setGuiPower("carB", "heavy");
      this.gui?.showMessage("Car B picked up Heavy");
    });
    this.key_triggered_button("A orbit power", ["y"], () => {
      this.setGuiPower("carA", "orbit");
      this.gui?.showMessage("Car A picked up Orbit");
    })
    this.key_triggered_button("B orbit power", ["h"], () => {
      this.setGuiPower("carB", "orbit");
      this.gui?.showMessage("Car B picked up Orbit");
    });
    this.key_triggered_button("clear powers", ["o"], () => {
      this.setGuiPower("carA", "none");
      this.setGuiPower("carB", "none");
      this.gui?.hideMessage();
    });
    this.new_line();
    this.key_triggered_button("damage A (-10)", ["j"], () => {
      this.applyGuiDamage("carA", 10);
    });
    this.key_triggered_button("damage B (-10)", ["k"], () => {
      this.applyGuiDamage("carB", 10);
    });
    this.key_triggered_button("heal both (+10)", ["l"], () => {
      this.guiHealth.carA = clamp(this.guiHealth.carA + 10, 0, 100);
      this.guiHealth.carB = clamp(this.guiHealth.carB + 10, 0, 100);
      this.gui?.updateHealth(this.guiHealth.carA, this.guiHealth.carB);
      console.log(
        "Car A health:",
        this.guiHealth.carA,
        "Car B health:",
        this.guiHealth.carB,
      );
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
      switch (this.gameView.cameraPin) {
        case "follow":
          this.gameView.cameraPin = "detached";
          break;
        case "detached":
          this.gameView.cameraPin = "carA";
          break;
        case "carA":
          this.gameView.cameraPin = "carB";
          break;
        case "carB":
          this.gameView.cameraPin = "follow";
          break;
      }
    });
    this.live_string((elem) => {
      elem.style.paddingLeft = "20px";
      elem.textContent = `status: ${this.gameView.cameraPin}`;
    });
    this.new_line();
    this.key_triggered_button("toggle meshes", ["m"], () => {
      this.globalProps.showMeshes = !this.globalProps.showMeshes;
    });
    this.live_string((elem) => {
      elem.style.paddingLeft = "20px";
      elem.textContent = `meshes: ${this.globalProps.showMeshes ? "ON" : "OFF"}`;
    });
    this.new_line();
    this.key_triggered_button("reset", ["t"], () => {
      this.resetGame();
    });
  }
}
