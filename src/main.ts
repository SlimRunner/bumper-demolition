import { ComponentLayoutOptions, tiny } from "../tiny-graphics";
import { defs } from "../examples/common";
import { math } from "../tiny-graphics-math";
import { UVShader } from "./shaders/UVShader";
import { SolidColor } from "./shaders/solidColor";
import { Axis3D } from "./shapes/axis3d";
import { GimbalCamera } from "./cameras/gimbalCamera";
import { SimpleGrid } from "./shapes/simpleGrid";
import { CartArmature, CartNodeNames } from "./rigging/cartArmature";
import { CartFrame } from "./physics/cartFrame";
import { MSDFrameShape } from "./shapes/msdShape";
import { range } from "./utils/iterators";
import { basisChange, clamp, lerp, smoothstep } from "./utils/math";
import { FileMesh } from "./shapes/fileMesh";
import { ActionCamera } from "./cameras/actionCamera";
import { ComplexTextured, CplxMats } from "./shaders/complexTexture";
import { SkyboxWH } from "./shaders/skyboxShader";
import { GameGUI } from "./components/gameGui";
import { CarSound } from "./audio/carSound";
import { CollisionSound } from "./audio/collisionSound";
import { BladeSlashSound } from "./audio/bladeSlashSound";
import {
  calculateSunPosition,
  getAverageSkyColor,
  getGrayscale,
  getHorizonColor,
  getSunColor,
} from "./shaders/skyboxUtils";
import { DrawableShape, ShapeCollection } from "./shapes/types";
import { MatchManager } from "./components/gameMatch";
import type { CarName, PowerUpKind } from "./components/types";
import { Scheduler, SchedulerEvent } from "./components/eventScheduler";
import { CarNameLabels } from "./utils/text";
import { splatMats, SplatShader } from "./shaders/splatShader";
import { sdCylinderColumn } from "./linearAlgebra/sdfs";
import { applyMeshTransform, computeTangents } from "./shapes/extendMesh";
import { AudioSystem, SpatialSound } from "./audio/audioSystem";
import { MusicPlayer } from "./audio/musicPlayer";
import { AudioMixRegistry, defaultMixChannels } from "./audio/mixRegistry";
import { AbilityPickupSound } from "./audio/abilityPickupSound";
import {
  ExplosionEffect,
  SpawnExplosionOptions,
} from "./components/explosionEffect";
import { ExplosionSound } from "./audio/explosionSound";
import { OrbitHitSound } from "./audio/orbitHitSound";

type CarTarget = "carA" | "carB";
type BgmTrack = { label: string; path: string };

const bladeVolume = 0.4;
const bgMusicVol = 0.3;
const defaultBgmTracks: BgmTrack[] = [
  {
    label: "Batmap Stage 1 Cover",
    path: "../assets/sounds/batmap-stage-1-cover-trim.mp3",
  },
  {
    label: "Batman NES Synthwave",
    path: "../assets/sounds/soundtrack2/Batman_Nes_Theme_(Synthwave Remake-Cover).mp3",
  },
];
const defaultLowHealthTrackPath =
  "../assets/sounds/soundtrack2/Hang_On_Low_HP_Theme_VS_Champion_Zephyr.mp3";

export class BumperCarsBase extends tiny.Component {
  shapes: {
    grid: SimpleGrid;
    box: defs.Cube;
    cyl: defs.Cylindrical_Tube;
    ball: defs.Subdivision_Sphere;
    column: defs.Cylindrical_Tube;
  };
  colors: {
    readonly red: math.Vector4;
    readonly blue: math.Vector4;
    readonly gray: math.Vector4;
    readonly softBlue: math.Vector4;
    readonly yellow: math.Vector4;
    readonly white: math.Vector4;
    readonly brightRed: math.Vector4;
    readonly brightOrange: math.Vector4;
    readonly electricBlue: math.Vector4;
    readonly heavyBox: math.Vector4;
    readonly orbitBox: math.Vector4;
    readonly sparkColors: math.Vector4;
    readonly columnOfDeath: math.Vector4;
    readonly columnOfWires: math.Vector4;
    readonly columnOfDeathLight: math.Vector4;
    sunAmbient: math.Vector4;
    sunColor: math.Vector4;
    skyHorizon: math.Vector4;
  };
  transforms: {
    readonly identity: math.Mat4;
    readonly powerupBox: math.Mat4;
    readonly background: math.Mat4;
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
    skybox: {
      shader: SkyboxWH;
      sun_zenith: number;
      sun_azimuth: number;
    };
    splats: {
      shader: SplatShader;
    } & splatMats;
  };
  armatures: {
    carA: CartArmature;
    carB: CartArmature;
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
    grassMound: ShapeCollection;
    explosionFx: ExplosionEffect;
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
    timer: number;
    suddenDeath: {
      enabled: boolean;
      timer: number;
      radius: number;
      readonly initRadius: number;
      readonly duration: number;
      readonly damageRate: (t: number, dist: number) => number;
    };
  };

  gui?: GameGUI;

  sound: {
    system: AudioSystem;
    effects: {
      engine: CarSound;
      collision: CollisionSound;
      ability: AbilityPickupSound;
      orbitHit: OrbitHitSound;
      explosion: ExplosionSound;
      wastedVoice: ExplosionSound;
      sawBlade: {
        carA: SpatialSound;
        carB: SpatialSound;
      };
    };
    music: {
      normal: MusicPlayer;
      lowHealth: MusicPlayer;
    };
  };

  readonly lightCount = 7;
  protected sawVolumeScale = 1;

  constructor() {
    super();

    this.colors = {
      red: math.color(0.8, 0.1, 0.1, 1),
      blue: math.color(0, 0, 1, 1),
      gray: math.color(0.6, 0.6, 0.6, 1),
      softBlue: math.color(0.176, 0.439, 0.702, 1),
      yellow: math.color(1, 1, 0, 1),
      white: math.color(1, 1, 1, 1),
      brightRed: math.color(1, 0.2, 0, 1),
      brightOrange: math.color(1, 0.36, 0, 1),
      electricBlue: math.color(0, 0.94, 1, 1),
      sunAmbient: math.color(0, 0, 0, 0),
      sunColor: math.color(1, 1, 1, 0),
      skyHorizon: math.color(0, 0, 0, 0),
      heavyBox: math.color(1, 1, 0, 0.4),
      orbitBox: math.color(1, 0, 1, 0.4),
      sparkColors: math.color(1, 0.66, 0.33, 0.5),
      columnOfDeath: math.color(1, 1, 1, 0.06),
      columnOfWires: math.color(1, 0.66, 0.33, 0.1),
      columnOfDeathLight: math.color(1, 0.66, 0.33, 1),
    };

    this.transforms = {
      identity: math.Mat4.identity(),
      powerupBox: math.Mat4.rotation((7 * Math.PI) / 36, 0, 0, 1)
        .times(math.Mat4.rotation(Math.PI / 4, 1, 0, 0))
        .times(
          math.Mat4.scale(
            1.5 / Math.sqrt(12),
            1.5 / Math.sqrt(12),
            1.5 / Math.sqrt(12),
          ),
        ),
      background: math.Mat4.translation(0, -2, 0).times(
        math.Mat4.scale(300, 40, 300),
      ),
    };

    const uvShader = new UVShader();
    const phongShader = new defs.Phong_Shader(this.lightCount);
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
      skybox: {
        shader: new SkyboxWH(),
        sun_azimuth: Math.PI * 0.4,
        sun_zenith: Math.PI * 0.35,
      },
      splats: {
        shader: new SplatShader(),
        color: this.colors.white,
        point_size: 150,
      },
    };

    const grid = new SimpleGrid(51, 51, { x: [-25, 25], z: [-25, 25] });
    const cubeShape = new defs.Cube();
    const sphereShape = new defs.Subdivision_Sphere(4);
    const closedTube = new defs.Capped_Cylinder(1, 24, [
      [0, 2],
      [0, 1],
    ]);
    const columnCyl = new defs.Cylindrical_Tube(1, 64, [
      [0, 2],
      [0, 1],
    ]);
    applyMeshTransform(columnCyl, math.Mat4.rotation(Math.PI / 2, 1, 0, 0));

    const tireMesh = new FileMesh("../assets/meshes/wheels-tire-mmc.obj", {
      // preTransform: math.Mat4.scale(3.49, 3.49, 3.49),
      preTransform: math.Mat4.rotation(-Math.PI / 2, 0, 1, 0)
        .times(math.Mat4.scale(3.521, 2.255, 2.255))
        .times(math.Mat4.translation(0, 0, -1)),
      lightCount: this.lightCount,
    });
    const chasisMeshRed = new FileMesh("../assets/meshes/CarChasis_Red.obj", {
      preTransform: math.Mat4.translation(0.261, 0, 0).times(
        math.Mat4.scale(0.559, 1.218, 1.152),
      ),
      lightCount: this.lightCount,
    });
    const chasisMeshBlue = new FileMesh("../assets/meshes/CarChasis_Blue.obj", {
      preTransform: math.Mat4.translation(0.261, 0, 0).times(
        math.Mat4.scale(0.559, 1.218, 1.152),
      ),
      lightCount: this.lightCount,
    });
    const sawMesh = new FileMesh("../assets/meshes/Sawblade_2.obj", {
      preTransform: math.Mat4.scale(0.62, 0.62, 0.62),
      lightCount: this.lightCount,
    });
    const saw_arm1_mesh = new FileMesh("../assets/meshes/SawArm1_1.obj", {
      preTransform: math.Mat4.translation(0, 0, -0.495).times(
        math.Mat4.scale(1.208, 1.208, 0.0789),
      ),
      lightCount: this.lightCount,
    });
    const saw_arm2_mesh = new FileMesh("../assets/meshes/SawArm2_1.obj", {
      preTransform: math.Mat4.translation(0, 0, -0.495).times(
        math.Mat4.scale(1.208, 1.208, 0.0789),
      ),
      lightCount: this.lightCount,
    });
    const arenaFloor = new FileMesh(
      "../assets/meshes/capsule-shape-arena-floor.obj",
      {
        preTransform: math.Mat4.rotation(Math.PI / 2, 0, 1, 0),
        uvScaling: math.Vector.create(2, 2),
        lightCount: this.lightCount,
      },
    );
    const arenaWalls = new FileMesh(
      "../assets/meshes/capsule-shape-arena-walls.obj",
      {
        preTransform: math.Mat4.rotation(Math.PI / 2, 0, 1, 0),
        uvScaling: math.Vector.create(1, 1.2),
        lightCount: this.lightCount,
      },
    );
    const grassMound = new FileMesh("../assets/meshes/grass-mound.obj", {
      preTransform: math.Mat4.translation(0, -0.2, 0).times(
        math.Mat4.rotation(Math.PI / 2, 0, 1, 0),
      ),
      uvScaling: math.Vector.create(75, 75),
      lightCount: this.lightCount,
    });

    this.shapes = {
      grid: grid,
      box: cubeShape,
      cyl: closedTube,
      ball: sphereShape,
      column: columnCyl,
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
      timer: 0,
      suddenDeath: {
        // actual radius is in contactField (this is just guesswork). Be
        // careful if you update
        initRadius: 25,
        radius: 25,
        duration: 30,
        timer: 0,
        enabled: false,
        damageRate: (t, d) => 20,
      },
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
      carA: new CartArmature({
        dimensions: cartDims,
        meshes: cartMeshesA,
      }),
      carB: new CartArmature({
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
      grassMound,
      explosionFx: new ExplosionEffect(this.lightCount),
    };
    this.physics = {
      cartMSD,
    };

    const audioSystem = new AudioSystem();
    this.sound = {
      system: new AudioSystem(),
      effects: {
        engine: new CarSound(
          audioSystem,
          "../assets/sounds/newEngineSounds/engineSim_idle.mp3",
          "../assets/sounds/newEngineSounds/engineSim_HalfThrottle.mp3",
          "../assets/sounds/newEngineSounds/engineSim_fullThrottle.mp3",
        ),
        collision: new CollisionSound(
          "../assets/sounds/car-collision-slow.mp3",
          "../assets/sounds/car-collision-fast.mp3",
        ),
        ability: new AbilityPickupSound({
          heavy: [
            "../assets/sounds/newAbilitySounds/metalskin_cast.mp3"
          ],
          orbit: [
            "../assets/sounds/newAbilitySounds/unicorn_dazzling_orb_cast_delay.mp3"
          ],
        }),
        orbitHit: new OrbitHitSound([
          "../assets/sounds/newAbilitySounds/unicorn_dazzling_orb_bounce_01.mp3"
        ]),
        explosion: new ExplosionSound(
          "../assets/sounds/deltarune-explosion.mp3",
          0.8,
        ),
        wastedVoice: new ExplosionSound(
          "../assets/sounds/gta5-wasted-hd.mp3",
          1,
        ),
        sawBlade: {
          carA: new SpatialSound(
            audioSystem,
            "../assets/sounds/saw-running-82131.mp3",
          ),
          carB: new SpatialSound(
            audioSystem,
            "../assets/sounds/saw-running-82131.mp3",
          ),
        },
      },
      music: {
        normal: new MusicPlayer(defaultBgmTracks[0].path),
        lowHealth: new MusicPlayer(defaultLowHealthTrackPath),
      },
    };

    this.sound.music.normal.setVolume(0);
    this.sound.music.lowHealth.setVolume(0);

    const {carA: soundBladeA, carB: soundBladeB} = this.sound.effects.sawBlade;

    soundBladeA.preservesPitch = false;
    soundBladeB.preservesPitch = false;

    this.armatures.carA.addEventListener("slash_started", () => {
      soundBladeA.play(bladeVolume * this.sawVolumeScale);
      soundBladeA.setRate(1);
    });
    this.armatures.carA.addEventListener("blade_is_reaching", () => {
      cartMSD.enableSparks("carA");
    });
    this.armatures.carA.addEventListener(
      "blade_is_returning",
      ({ completion }) => {
        const t = smoothstep(1 - completion);
        soundBladeA.setRate(lerp(1, 0.8, completion));
        soundBladeA.setVolume(bladeVolume * t * this.sawVolumeScale);
      },
    );
    this.armatures.carA.addEventListener("blade_retreated", () => {
      cartMSD.disableSparks("carA");
    });
    this.armatures.carA.addEventListener("blade_returned", () => {
      soundBladeA.stop();
    });

    this.armatures.carB.addEventListener("slash_started", () => {
      soundBladeB.play(bladeVolume * this.sawVolumeScale);
      soundBladeB.setRate(1);
    });
    this.armatures.carB.addEventListener("blade_is_reaching", () => {
      cartMSD.enableSparks("carB");
    });
    this.armatures.carB.addEventListener(
      "blade_is_returning",
      ({ completion }) => {
        const t = smoothstep(1 - completion);
        soundBladeB.setRate(lerp(1, 0.8, completion));
        soundBladeB.setVolume(bladeVolume * t * this.sawVolumeScale);
      },
    );
    this.armatures.carB.addEventListener("blade_retreated", () => {
      cartMSD.disableSparks("carB");
    });
    this.armatures.carB.addEventListener("blade_returned", () => {
      soundBladeB.stop();
    });

    document.addEventListener("visibilitychange", () => {
      // this prevents the window from hanging due to the physics loop
      // (which has a fixed time delta) trying to step through a large
      // time delta. Consider it a pause sync with the browser since it
      // idles requestAnimationFrame when the window loses visibility.
      this.globalProps.isIdling = document.hidden;
    });
  }

  protected resetGame() {
    const GP = this.globalProps;
    // this is just one function right now but keep it because we may
    // need to reset other things later.
    GP.suddenDeath.enabled = false;
    GP.suddenDeath.timer = 0;
    GP.suddenDeath.radius = GP.suddenDeath.initRadius;
    this.physics.cartMSD.resetState();
    this.armatures.carA.resetState();
    this.armatures.carB.resetState();
    this.gui?.resetState();
    GP.timer = 0;
    GP.timeMultiplier = 1;
  }

  render_layout(div: HTMLDivElement, options?: ComponentLayoutOptions): void {
    super.render_layout(div, options);

    // even if you remove the camera leave this in. We can leverage it
    // to add a gui with CSS.
    const canvas = this.canvas ?? document.getElementById("canvas")!;
    const canvasDiv = document.createElement("div");
    canvas.parentElement?.insertBefore(canvasDiv, canvas);
    canvasDiv.insertBefore(canvas, null);

    const resumeUser = () => {
      this.sound.system.resume();
      canvas.removeEventListener("click", resumeUser);
    };
    canvas.addEventListener("click", resumeUser);

    this.gui = new GameGUI(canvasDiv);

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

    this.gui.resetState();
  }

  render_animation(context: tiny.Component): void {
    const time = (this.uniforms.animation_time ?? 0) / 1000;
    const timeDelta = (this.uniforms.animation_delta_time ?? 0) / 1000;
    const timeMult = this.globalProps.timeMultiplier;

    this.globalProps.timer += timeDelta * timeMult;

    // camera should not be subject to slow motion
    this.gameView.actionCam!.updateCamera(timeDelta);

    const { cameraMatrix, position } =
      this.gameView.cameraPin === "follow"
        ? this.gameView.actionCam!.getCameraTransform()
        : this.gameView.gimbalCam!.getCameraTransform();

    tiny.Shader.assign_camera(cameraMatrix, this.uniforms);

    this.uniforms.projection_transform = math.Mat4.perspective(
      this.gameView.fov,
      this.gameView.aspectRatio,
      0.02,
      500,
    );

    const clockT = clamp(this.gui!.currentTime / 120, 0, 1);
    const clockHour = lerp(5, 19, smoothstep(clockT));
    const { sun_azimuth, sun_zenith } = calculateSunPosition(clockHour, 0.3, 6);
    const sunColor = getSunColor({ sun_azimuth, sun_zenith });
    const sunAmbient = getAverageSkyColor({ sun_azimuth, sun_zenith });
    const horizonColor = getHorizonColor({ sun_azimuth, sun_zenith });
    this.colors.sunColor = sunColor;
    this.colors.sunAmbient = sunAmbient;
    this.colors.skyHorizon = horizonColor;

    // const sunLuminance = getGrayscale(sunColor);
    const skyLuminance = getGrayscale(sunAmbient);
    this.materials.skybox.sun_azimuth = sun_azimuth;
    this.materials.skybox.sun_zenith = sun_zenith;
    const light_dir = math.vec4(
      10 * Math.sin(sun_zenith) * Math.cos(sun_azimuth),
      10 * Math.cos(sun_zenith),
      10 * Math.sin(sun_zenith) * Math.sin(sun_azimuth),
      0,
    );
    const backdrop_dir = math.vec4(
      10 * Math.sin(-sun_zenith) * Math.cos(sun_azimuth),
      10 * Math.cos(sun_zenith),
      10 * Math.sin(sun_zenith) * Math.sin(sun_azimuth),
      0,
    );
    this.uniforms.lights = [
      defs.Phong_Shader.light_source(light_dir, sunColor, 620),
      defs.Phong_Shader.light_source(backdrop_dir, sunAmbient, 100),
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
          lerp(440, 0, clamp((skyLuminance - 0.25) * 5, 0, 1)),
        ),
      );
    }
    if (this.globalProps.suddenDeath.enabled) {
      const tFlicker = time * timeMult;
      const cs = 0.3 * Math.sin(tFlicker * 60) + 0.7 * Math.cos(tFlicker * 37);
      this.uniforms.lights.push(
        defs.Phong_Shader.light_source(
          math.vec4(0, 50, 0, 1),
          this.colors.columnOfDeathLight,
          2000 + 250 * cs,
        ),
      );
    } else {
      this.uniforms.lights.push(
        defs.Phong_Shader.light_source(
          math.vec4(0, 50, 0, 1),
          this.colors.columnOfDeathLight,
          0,
        ),
      );
    }
  }
}

type EventNamespace =
  | "intro_look_up"
  | "match_loop"
  | "outro"
  | "enable_physics";

export class BumperCars extends BumperCarsBase {
  gameMatch: MatchManager;
  scheduler: Scheduler<EventNamespace, SchedulerEvent<EventNamespace>>;
  private isMatchOver = false;
  private winner?: CarName;
  private readonly mixRegistry = new AudioMixRegistry(defaultMixChannels);
  private readonly bgmTracks = defaultBgmTracks;
  private bgmTrackIndex = 0;
  private masterMixVolume = 1;
  private musicMixVolume = bgMusicVol;
  private sfxMixVolume = 1;
  private readonly lowHealthThresholdPercent = 20;
  private readonly lowHealthSmokeSpawnInterval = 0.18;
  private readonly lowHealthSmokeForwardOffset = 0.65;
  private readonly lowHealthSmokeUpOffset = 0.5;
  private readonly lowHealthSmokeVisual: SpawnExplosionOptions = {
    enabled: {
      inner: false,
      outer: false,
      gust: false,
      shockwave: false,
      streaks: false,
      smoke: true,
    },
    smoke: {
      delay: 0,
      count: 3,
      fadeInTime: 0.05,
      fadeOutTime: 0.28,
      lifetimeMin: 4,
      lifetimeMax: 6,
      riseSpeedMin: 1,
      riseSpeedMax: 1,
      driftSpeedMin: 0.04,
      driftSpeedMax: 0.18,
      startSizeMin: 0.14,
      startSizeMax: 0.2,
      endSizeMin: 0.4,
      endSizeMax: 0.65,
      alpha: 0.38,
    },
  };
  private readonly lowHealthSmokeTimer: Record<CarName, number> = {
    carA: 0,
    carB: 0,
  };
  private readonly musicMix = {
    lowHealthLayer: 0.95,
    normalWhileLowHealth: 0,
    pausedFactor: 0.25,
    crossFadeSeconds: 0.45,
    roundStartFadeSeconds: 1.2,
  };
  private isLowHealthLayerActive = false;
  private pendingLowHealthStopTimer?: number;
  private lastNormalTarget = -1;
  private lastLowHealthTarget = -1;
  private gameOverSlowMoTimeout?: number;
  private readonly gameOverSlowMoDelayMs = 5;
  private readonly gameOverTimeMultiplier = 0.08;
  private readonly gameOverTextRevealDelayMs = 2650;
  private readonly gameOverSequenceDuration = 6;
  private readonly playGameOverExplosionSound = false;
  private readonly gameOverQuotes = [
    "{loserColor}, you're chopped lil bro.",
    "Better luck next time, {loserColor}.",
    "Carmogged, carmaxxed, i'll just stop now.",
    "I hope nobody reads this... surely.",
    "{loserColor}, {loserColor}, what's your problem {loserColor}? Me stay alone ramp, me stay alone ramp",
    "{loserColor} fainted.",
    "That's it {loserColor}, play dead we got em right where we-... oh dear",
    "{loserColor} died before GTA 6"
  ];

  constructor() {
    super();

    this.recomputeMixChannels();

    const cartMSD = this.physics.cartMSD;
    const armatureA = this.armatures.carA;
    const armatureB = this.armatures.carB;

    this.gameMatch = new MatchManager();

    this.gameMatch.addEventListener("suddenDeath", (args) => {
      const { suddenDeath } = this.globalProps;
      if (!suddenDeath.enabled) {
        this.gui?.showMessage("SUDDEN DEATH");
        suddenDeath.enabled = true;
        suddenDeath.timer = 0;
        this.syncMusicMix();
      }
    });
    this.gameMatch.addEventListener("gameOver", (args) => {
      this.winner = args.loser === "carA" ? "carB" : "carA";
      this.isMatchOver = true;
      this.stopAllMusic();
      this.startGameOverSequence(args.loser);
    });
    this.gameMatch.addEventListener("powerSpawn", (args) => {
      switch (args.count) {
        case 0:
          cartMSD.spawnPowerup(args.kind, math.vec3(0, 0.75, 10));
          break;
        case 1:
          cartMSD.spawnPowerup(args.kind, math.vec3(0, 0.75, -10));
          break;
        default:
          cartMSD.spawnPowerup(args.kind);
      }
    });
    this.gameMatch.addEventListener("powerExpires", (args) => {
      switch (args.kind) {
        case "heavy":
          cartMSD.makeLight(args.player);
          this.setThrust(args.player, 120);
          break;
        case "orbit":
          cartMSD.setOrbitStatus(args.player, true);
          break;
      }
    });

    const gameEvents: SchedulerEvent<EventNamespace>[] = [
      // TODO: camera looking to the sky to let the meshes load out of sight
      {
        type: "event",
        ident: "intro_look_up",
        isExpired: (t) => {
          this.gui?.showMessage(Math.ceil(4 - t).toString());
          return t >= 4;
        },
      },

      /* TODO: cinematic pan over the players
      { type: "timed", ident: "intro_line_up_A", duration: 2 },
      { type: "timed", ident: "intro_line_up_B", duration: 2 },
      */

      /* TODO: show off skybox and time management
      { type: "timed", ident: "intro_day_cycle", duration: 2 },
      */

      //event used to prevent hard resets
      { type: "event", ident: "enable_physics", isExpired: () => true },

      // main match event
      { type: "event", ident: "match_loop", isExpired: () => this.isMatchOver },
      // TODO: outro animation with slow motion and winner toast
      { type: "timed", ident: "outro", duration: this.gameOverSequenceDuration },
    ];
    this.scheduler = new Scheduler(
      [...gameEvents],
      (ident, elapsed) => {
        switch (ident) {
          case "intro_look_up":
            // count down?
            break;
          case "enable_physics":
            this.startRoundMusic();
            this.physics.cartMSD.enable = true;
            break;
          case "match_loop":
            // swap to ActionCamera in prev step (if multiple cameras)
            if (this.winner) {
              this.gui?.showMessage(
                `Player ${CarNameLabels[this.winner].colorName} WINS!!`,
              );
              // Do nothing for now, since you said MatchManager tracks score.
              // We'll increment the score in MatchManager instead of through GUI directly.
              this.gameMatch.addScore(this.winner);
            } else {
              console.warn(`winner is undefined during win toast`);
            }
            break;
          case "outro":
            // nothing to do yet
            break;
        }
      },
      () => {
        // game finished
        this.resetGame();
        this.isMatchOver = false;
        this.winner = undefined;
      },
    );
  }

  private setNormalTrack(index: number) {
    const track = this.bgmTracks[index];
    if (!track) return;

    this.bgmTrackIndex = index;
    this.sound.music.normal.setSource(track.path);
    this.sound.music.normal.play();
    this.applyMusicTargets({ force: true, fadeSeconds: 0.2 });
  }

  private stepMasterVolume(delta: number) {
    this.masterMixVolume = clamp(this.masterMixVolume + delta, 0, 1);
    this.recomputeMixChannels();
  }

  private stepMusicVolume(delta: number) {
    this.musicMixVolume = clamp(this.musicMixVolume + delta, 0, 1);
    this.recomputeMixChannels();
  }

  private stepSfxVolume(delta: number) {
    this.sfxMixVolume = clamp(this.sfxMixVolume + delta, 0, 1);
    this.recomputeMixChannels();
  }

  private recomputeMixChannels() {
    const master = this.masterMixVolume;
    const music = this.musicMixVolume;
    const sfx = this.sfxMixVolume;

    this.mixRegistry.setVolume("normalBgm", master * music);
    this.mixRegistry.setVolume("lowHealthBgm", master * music);

    this.mixRegistry.setVolume("engine", master * sfx);
    this.mixRegistry.setVolume("collision", master * sfx);
    this.mixRegistry.setVolume("ability", master * sfx);
    this.mixRegistry.setVolume("saw", master * sfx);
    this.mixRegistry.setVolume("gameOver", master * sfx);

    this.sawVolumeScale = this.mixRegistry.getVolume("saw");
    this.applyEffectMixVolumes();
    this.applyMusicTargets({ force: true, fadeSeconds: 0.1 });
  }

  private applyEffectMixVolumes() {
    this.sound.effects.engine.setMasterVolume(this.mixRegistry.getVolume("engine"));
    this.sound.effects.collision.setMasterVolume(
      this.mixRegistry.getVolume("collision"),
    );
    this.sound.effects.ability.setMasterVolume(
      this.mixRegistry.getVolume("ability"),
    );
    this.sound.effects.orbitHit.setMasterVolume(
      this.mixRegistry.getVolume("ability"),
    );
    const gameOverVolume = this.mixRegistry.getVolume("gameOver");
    this.sound.effects.explosion.setMasterVolume(gameOverVolume);
    this.sound.effects.wastedVoice.setMasterVolume(gameOverVolume);
  }

  private cycleNormalTrack() {
    if (this.bgmTracks.length === 0) return;
    const nextIndex = (this.bgmTrackIndex + 1) % this.bgmTracks.length;
    this.setNormalTrack(nextIndex);
  }

  private shouldUseLowHealthLayer() {
    if (this.globalProps.suddenDeath.enabled) {
      return true;
    }

    const hpA = this.gameMatch.getHealth("carA");
    const hpB = this.gameMatch.getHealth("carB");
    return (
      hpA <= this.lowHealthThresholdPercent ||
      hpB <= this.lowHealthThresholdPercent
    );
  }

  private applyMusicTargets(options?: { force?: boolean; fadeSeconds?: number }) {
    const force = options?.force ?? false;
    const fadeSeconds = options?.fadeSeconds ?? this.musicMix.crossFadeSeconds;

    const pauseFactor = this.physics.cartMSD.enable
      ? 1
      : this.musicMix.pausedFactor;

    const normalWeight = this.globalProps.suddenDeath.enabled
      ? 0
      : this.isLowHealthLayerActive
      ? this.musicMix.normalWhileLowHealth
      : 1;
    const lowHealthWeight = this.isLowHealthLayerActive
      ? this.musicMix.lowHealthLayer
      : 0;

    const baseVolume = pauseFactor;
    const normalTarget = clamp(
      baseVolume * normalWeight * this.mixRegistry.getVolume("normalBgm"),
      0,
      1,
    );
    const lowHealthTarget = clamp(
      baseVolume * lowHealthWeight * this.mixRegistry.getVolume("lowHealthBgm"),
      0,
      1,
    );

    if (force || Math.abs(normalTarget - this.lastNormalTarget) > 0.004) {
      this.sound.music.normal.fadeTo(normalTarget, fadeSeconds);
      this.lastNormalTarget = normalTarget;
    }
    if (force || Math.abs(lowHealthTarget - this.lastLowHealthTarget) > 0.004) {
      this.sound.music.lowHealth.fadeTo(lowHealthTarget, fadeSeconds);
      this.lastLowHealthTarget = lowHealthTarget;
    }
  }

  private syncMusicMix() {
    const shouldPlayLowHealth = this.shouldUseLowHealthLayer();

    if (shouldPlayLowHealth !== this.isLowHealthLayerActive) {
      this.isLowHealthLayerActive = shouldPlayLowHealth;

      if (this.pendingLowHealthStopTimer !== undefined) {
        window.clearTimeout(this.pendingLowHealthStopTimer);
        this.pendingLowHealthStopTimer = undefined;
      }

      if (shouldPlayLowHealth) {
        this.sound.music.lowHealth.play(true);
      } else {
        const delay = this.musicMix.crossFadeSeconds * 1000 + 80;
        this.pendingLowHealthStopTimer = window.setTimeout(() => {
          if (!this.isLowHealthLayerActive) {
            this.sound.music.lowHealth.stop();
          }
          this.pendingLowHealthStopTimer = undefined;
        }, delay);
      }

      this.applyMusicTargets({ force: true });
      return;
    }

    this.applyMusicTargets();
  }

  private stopAllMusic() {
    if (this.pendingLowHealthStopTimer !== undefined) {
      window.clearTimeout(this.pendingLowHealthStopTimer);
      this.pendingLowHealthStopTimer = undefined;
    }

    this.sound.music.normal.fadeTo(0, 0.2);
    this.sound.music.lowHealth.fadeTo(0, 0.2);

    window.setTimeout(() => {
      this.sound.music.normal.pause();
      this.sound.music.lowHealth.stop();
    }, 220);

    this.lastNormalTarget = 0;
    this.lastLowHealthTarget = 0;
    this.isLowHealthLayerActive = false;
  }

  private startRoundMusic() {
    if (this.pendingLowHealthStopTimer !== undefined) {
      window.clearTimeout(this.pendingLowHealthStopTimer);
      this.pendingLowHealthStopTimer = undefined;
    }

    this.isLowHealthLayerActive = false;
    this.lastNormalTarget = -1;
    this.lastLowHealthTarget = -1;

    this.sound.music.lowHealth.stop();
    this.sound.music.lowHealth.setVolume(0);

    this.sound.music.normal.play();
    this.sound.music.normal.setVolume(0);
    this.sound.music.normal.fadeTo(
      this.mixRegistry.getVolume("normalBgm"),
      this.musicMix.roundStartFadeSeconds,
    );
    this.lastNormalTarget = this.mixRegistry.getVolume("normalBgm");
    this.lastLowHealthTarget = 0;
  }

  private getRandomGameOverQuote(loser: CarName) {
    const winner: CarName = loser === "carA" ? "carB" : "carA";
    const idx = Math.floor(Math.random() * this.gameOverQuotes.length);
    return this.gameOverQuotes[idx]
      .replace(/\{loserColor\}/g, CarNameLabels[loser].colorName)
      .replace(/\{winnerColor\}/g, CarNameLabels[winner].colorName);
  }

  private startGameOverSequence(loser: CarName) {
    this.sound.effects.wastedVoice.play(this.mixRegistry.getVolume("gameOver"));

    const loserPos = this.physics.cartMSD.transforms[loser].center;
    const xzJitter = 1;
    const explosionPos = math.vec3(
      loserPos[0] + (Math.random() * 2 - 1) * xzJitter,
      loserPos[1] - 0.65,
      loserPos[2] + (Math.random() * 2 - 1) * xzJitter,
    );

    this.spawnExplosion(explosionPos, {
      blastRadius: 2,
      blastImpulse: 100,
      blastVerticalScale: 0.3,
      withForce: true,
      playSound: this.playGameOverExplosionSound,
      soundVolume: this.mixRegistry.getVolume("gameOver"),
    });

    this.gameView.cameraPin = loser;
    this.gameView.gimbalCam?.setOrigin(loserPos);
    this.globalProps.timeMultiplier = 1;

    if (this.gameOverSlowMoTimeout !== undefined) {
      window.clearTimeout(this.gameOverSlowMoTimeout);
    }

    this.gameOverSlowMoTimeout = window.setTimeout(() => {
      this.globalProps.timeMultiplier = this.gameOverTimeMultiplier;
      this.gui?.showGameOverOverlay(this.getRandomGameOverQuote(loser), {
        textDelayMs: this.gameOverTextRevealDelayMs,
      });
      this.gameOverSlowMoTimeout = undefined;
    }, this.gameOverSlowMoDelayMs);
  }

  render_layout(div: HTMLDivElement, options?: ComponentLayoutOptions): void {
    super.render_layout(div, options);

    // free particle collision detection
    const cartMSD = this.physics.cartMSD;
    const gmMatch = this.gameMatch;

    gmMatch.linkGUI(this.gui!);

    // notify main component when the two cars exchange forces
    cartMSD.onCollision = (player, impulse) => {
      // impulse is the integral of the normal force over the physics step.
      // damage is scaled arbitrarily; tune to taste or convert to energy
      // later if you prefer (0.5*m*v^2 loss etc.)
      const other: CarTarget = player === "carA" ? "carB" : "carA";
      gmMatch.makeDamage(other, impulse * 0.04);
      this.sound.effects.collision.accumulate(impulse);
      // this.collisionSound?.accumulate(impulse);
    };

    cartMSD.msdSystem.trespassCB = (p, field) => {
      let target: CarTarget | undefined;
      let source: CarTarget | undefined;

      if (field.group.has("carA")) {
        source = "carA";
        target = "carB";
      } else if (field.group.has("carB")) {
        source = "carB";
        target = "carA";
      } else {
        console.warn("target is neither carA or carB");
        return;
      }

      if (p.group.has("orbit")) {
        p.disabled = true;
        gmMatch.makeDamage(target, 1);
        this.sound.effects.orbitHit.play({
          pitchJitter: 0.08,
          volumeJitter: 0.15,
        });
      } else if (p.group.has("sawblade")) {
        if (this.armatures[source].isArmSpinning()) {
          gmMatch.makeDamage(target, 0.013);
        }
      } else if (p.group.has("powerup") && !gmMatch.getPowerup(target)) {
        p.disabled = true;
        this.gui?.showMessage(
          `${CarNameLabels[target].labelName} picked up ${p.metadata}`,
        );
        const powerup = p.metadata as PowerUpKind;
        this.sound.effects.ability.play(powerup);
        gmMatch.setPowerup(target, powerup);
        if (powerup === "orbit") {
          this.physics.cartMSD.updateCarOrbits(0, true);
          this.physics.cartMSD.setOrbitStatus(target);
        } else if (powerup === "heavy") {
          this.physics.cartMSD.makeHeavy(target);
          this.setThrust(target, 240);
        }
      }
    };
  }

  protected resetGame(): void {
    super.resetGame();
    if (this.gameOverSlowMoTimeout !== undefined) {
      window.clearTimeout(this.gameOverSlowMoTimeout);
      this.gameOverSlowMoTimeout = undefined;
    }
    this.gameView.cameraPin = "follow";
    this.gui?.hideGameOverOverlay();
    this.gameMatch.resetState();
    this.scheduler.reset("enable_physics");
    this.lowHealthSmokeTimer.carA = 0;
    this.lowHealthSmokeTimer.carB = 0;
  }

  private maybeSpawnLowHealthSmoke(
    car: CarName,
    carTransform: math.Mat4,
    deltaSeconds: number,
  ) {
    if (this.isMatchOver || this.gameMatch.getHealth(car) > this.lowHealthThresholdPercent) {
      this.lowHealthSmokeTimer[car] = 0;
      return;
    }

    this.lowHealthSmokeTimer[car] += deltaSeconds;
    if (this.lowHealthSmokeTimer[car] < this.lowHealthSmokeSpawnInterval) {
      return;
    }

    const rightAxis = math.vec3(
      carTransform[0][0],
      carTransform[1][0],
      carTransform[2][0],
    );
    const axisLen = Math.hypot(rightAxis[0], rightAxis[1], rightAxis[2]);
    const forward = axisLen > 1e-6
      ? math.vec3(
          rightAxis[0] / axisLen,
          rightAxis[1] / axisLen,
          rightAxis[2] / axisLen,
        )
      : math.vec3(1, 0, 0);

    const spawnPos = math.vec3(
      carTransform[0][3] + forward[0] * this.lowHealthSmokeForwardOffset,
      carTransform[1][3] + this.lowHealthSmokeUpOffset,
      carTransform[2][3] + forward[2] * this.lowHealthSmokeForwardOffset,
    );

    this.spawnExplosion(spawnPos, {
      visual: this.lowHealthSmokeVisual,
      withForce: false,
      playSound: false,
    });

    this.lowHealthSmokeTimer[car] = Math.max(
      0,
      this.lowHealthSmokeTimer[car] - this.lowHealthSmokeSpawnInterval,
    );
  }

  protected setThrust(car: CarName, value: number) {
    switch (car) {
      case "carA":
        this.armatures.carA.maxThrust = value;
      case "carB":
        this.armatures.carB.maxThrust = value;
    }
  }

  render_animation(context: tiny.Component): void {
    super.render_animation(context);

    // accumulates all the subjects that need to be inside the frame
    const camSubjects: math.Vector3[] = [];

    const time = (this.uniforms.animation_time ?? 0) / 1000;
    const timeDelta = (this.uniforms.animation_delta_time ?? 0) / 1000;
    const timeMult = this.globalProps.timeMultiplier;
    const gblTimer = this.globalProps.timer;

    this.scheduler.update(timeDelta);

    const GL = context.context!;

    const CMT = this.uniforms?.camera_transform!;
    const cam_loc = CMT.sub_block([0, 3], [3, 4]).flat();

    const cartMSD = this.physics.cartMSD;
    const { carA: cartA, carB: cartB } = this.armatures;
    const { showMeshes, suddenDeath } = this.globalProps;
    const explosionFx = this.drawables.explosionFx;

    const paused = !cartMSD.enable || this.globalProps.isIdling;

    // do all time related oerations inside this if statement
    if (!paused) {
      cartMSD.dispatchParticles(timeDelta * timeMult);
      this.gui?.updateTimer(timeDelta * timeMult);
      this.gameMatch.updateExpiry(timeDelta * timeMult);
      this.gameMatch.checkTime();
      cartMSD.updateCarOrbits(timeDelta * timeMult);
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
          cartMSD.step(timeStep * timeMult);
        }

        const remainder = timeDelta - steps * timeStep;
        if (remainder > 0) {
          cartMSD.step(remainder * timeMult);
        }
      }

      const groundSpeeds = this.physics.cartMSD.getTireGroundSpeed();
      cartA.updateTires(groundSpeeds.carA, timeDelta * timeMult);
      cartB.updateTires(groundSpeeds.carB, timeDelta * timeMult);
      cartA.updateFrontWheels(tires.carA.frontLeft, tires.carA.frontRight);
      cartB.updateFrontWheels(tires.carB.frontLeft, tires.carB.frontRight);
      cartA.updateArm(timeDelta * timeMult);
      cartB.updateArm(timeDelta * timeMult);

      const camPos = math.vec3(cam_loc[0], cam_loc[1], cam_loc[2]);
      const camRight = math.vec3(CMT[0][0], CMT[0][1], CMT[0][2]);
      const avgWheelSpeed = CartFrame.averageGroundSpeeds(
        groundSpeeds.carA,
        groundSpeeds.carB,
      );
      this.sound.effects.engine.update({
        carA: {
          speed: avgWheelSpeed.carA,
          pos: cartMSD.transforms.carA.center,
          thrust: cartA.thrustForce,
        },
        carB: {
          speed: avgWheelSpeed.carB,
          pos: cartMSD.transforms.carB.center,
          thrust: cartB.thrustForce,
        },
        camera: {
          pos: camPos,
          right: camRight,
        },
      });

      if (suddenDeath.enabled) {
        const entities: [CarName, CarName] = ["carA", "carB"];
        suddenDeath.timer += timeDelta * timeMult;
        const t = Math.min(1, suddenDeath.timer / suddenDeath.duration);
        suddenDeath.radius = lerp(suddenDeath.initRadius, 0, smoothstep(t));

        for (const car of entities) {
          const dist = sdCylinderColumn(
            cartMSD.transforms[car].center,
            suddenDeath.radius,
            "xz",
          );
          if (dist >= 0) {
            const t = Math.min(1, suddenDeath.timer / suddenDeath.duration);
            const damage =
              suddenDeath.damageRate(t, dist) * timeDelta * timeMult;
            this.gameMatch.makeDamage(car, damage);
          }
        }
      }

      const { mtxCarA, mtxCarB } = cartMSD.getTransforms();
      this.maybeSpawnLowHealthSmoke("carA", mtxCarA, timeDelta * timeMult);
      this.maybeSpawnLowHealthSmoke("carB", mtxCarB, timeDelta * timeMult);

      explosionFx.update(timeDelta * timeMult);
    }

    this.sound.effects.engine.setPaused(paused);
    this.sound.effects.collision.flush(paused);
    this.syncMusicMix();

    // this pattern can be used to create a sky texture later
    GL.disable(GL.DEPTH_TEST);
    this.shapes.box.draw(
      context,
      this.uniforms,
      math.Mat4.translation(cam_loc[0], cam_loc[1], cam_loc[2]),
      this.materials.skybox,
    );
    GL.enable(GL.DEPTH_TEST);

    this.drawables.grassMound.foreach((shape, material, name) => {
      shape.draw(context, this.uniforms, this.transforms.background, {
        ...material,
        ambient_color: this.colors.sunAmbient,
        fog_color: this.colors.skyHorizon,
        smoothness: 10,
        ambient: 0.7,
        specularity: 0.2,
        bumpiness: 1.2,
        diffusivity: 0.8,
      });
    });

    this.drawables.arenaFloor.foreach((shape, material, name) => {
      shape.draw(context, this.uniforms, this.transforms.identity, {
        ...material,
        ambient_color: this.colors.sunAmbient,
        fog_color: this.colors.skyHorizon,
        smoothness: 20,
        ambnient: 0.4,
        specularity: 0.6,
      });
    });
    this.drawables.arenaWalls.foreach((shape, material, name) => {
      shape.draw(context, this.uniforms, this.transforms.identity, {
        ...material,
        ambient_color: this.colors.sunAmbient,
        fog_color: this.colors.skyHorizon,
        ambient: 0.4,
      });
    });

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

    if (showMeshes) {
      cartA.arcs.root.traverse((joint, node, matrix) => {
        const name = node.name as CartNodeNames;
        if (name === "saw") {
          cartMSD.setBlade(
            "carA",
            matrix[0][3],
            matrix[1][3] - 0.2,
            matrix[2][3],
          );
        }

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
        if (name === "saw") {
          cartMSD.setBlade("carB", matrix[0][3], matrix[1][3], matrix[2][3]);
        }

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
      cartA.arcs.root.traverse((joint, node, matrix) => {
        const name = node.name as CartNodeNames;
        if (name === "saw") {
          cartMSD.setBlade("carA", matrix[0][3], matrix[1][3], matrix[2][3]);
        }
      }, mtxCarA);
      cartB.arcs.root.traverse((joint, node, matrix) => {
        const name = node.name as CartNodeNames;
        if (name === "saw") {
          cartMSD.setBlade("carB", matrix[0][3], matrix[1][3], matrix[2][3]);
        }
      }, mtxCarB);
      this.drawables.cartFrame.draw(
        context,
        this.uniforms,
        this.transforms.identity,
      );
    }

    cartMSD.sparksShape.draw(
      context,
      this.uniforms,
      this.transforms.identity,
      {
        ...this.materials.solid,
        color: this.colors.sparkColors,
      },
      "LINES",
    );

    GL.depthMask(false);
    GL.enable(GL.BLEND);
    GL.blendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA);
    cartMSD.traverseBoxes((p, power) => {
      if (power == null) return;
      camSubjects.push(p.location);
      const [x, y, z] = p.location;
      const colors = {
        heavy: this.colors.heavyBox,
        orbit: this.colors.orbitBox,
      };
      this.shapes.box.draw(
        context,
        this.uniforms,
        math.Mat4.translation(x, y, z)
          .times(math.Mat4.rotation(gblTimer, 0, 1, 0))
          .times(this.transforms.powerupBox),
        {
          ...this.materials.plastic,
          color: colors[power],
        },
      );
    });
    cartMSD.orbitShape("carA").draw(
      context,
      this.uniforms,
      this.transforms.identity,
      {
        ...this.materials.splats,
        color: this.colors.brightRed,
      },
      "POINTS",
    );
    cartMSD.orbitShape("carB").draw(
      context,
      this.uniforms,
      this.transforms.identity,
      {
        ...this.materials.splats,
        color: this.colors.electricBlue,
      },
      "POINTS",
    );
    if (suddenDeath.enabled) {
      this.shapes.column.draw(
        context,
        this.uniforms,
        math.Mat4.scale(suddenDeath.radius, 1000, suddenDeath.radius),
        { ...this.materials.solid, color: this.colors.columnOfDeath },
      );
      this.shapes.column.draw(
        context,
        this.uniforms,
        math.Mat4.scale(suddenDeath.radius, 1000, suddenDeath.radius),
        { ...this.materials.solid, color: this.colors.sparkColors },
        "LINE_STRIP",
      );
    }
    explosionFx.draw(context, this.uniforms);
    GL.disable(GL.BLEND);
    GL.depthMask(true);

    // do this at the very end always
    this.gameView.actionCam!.updateTargets(camSubjects);
  }

  render_controls(): void {
    const { carA: cartA, carB: cartB } = this.armatures;

    // controls for car A
    this.live_string((elem) => {
      elem.textContent = "Car A";
    });
    this.key_triggered_button(
      "accelerate",
      ["w"],
      () => {
        cartA.thrustForce = cartA.maxThrust;
      },
      undefined,
      () => {
        cartA.thrustForce = 0;
      },
    );
    this.key_triggered_button(
      "brake",
      ["s"],
      () => {
        cartA.thrustForce = -cartA.maxThrust;
      },
      undefined,
      () => {
        cartA.thrustForce = 0;
      },
    );
    this.key_triggered_button(
      "steer left",
      ["a"],
      () => {
        cartA.steerTarget = -1;
      },
      undefined,
      () => {
        cartA.steerTarget = 0;
      },
    );
    this.key_triggered_button(
      "steer right",
      ["d"],
      () => {
        cartA.steerTarget = 1;
      },
      undefined,
      () => {
        cartA.steerTarget = 0;
      },
    );
    this.key_triggered_button("swing blade", ["e"], () => {
      cartA.swingArm();
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
        cartB.thrustForce = cartB.maxThrust;
      },
      undefined,
      () => {
        cartB.thrustForce = 0;
      },
    );
    this.key_triggered_button(
      "brake",
      ["5"],
      () => {
        cartB.thrustForce = -cartB.maxThrust;
      },
      undefined,
      () => {
        cartB.thrustForce = 0;
      },
    );
    this.key_triggered_button(
      "steer left",
      ["4"],
      () => {
        cartB.steerTarget = -1;
      },
      undefined,
      () => {
        cartB.steerTarget = 0;
      },
    );
    this.key_triggered_button(
      "steer right",
      ["6"],
      () => {
        cartB.steerTarget = 1;
      },
      undefined,
      () => {
        cartB.steerTarget = 0;
      },
    );
    this.key_triggered_button("swing blade", ["7"], () => {
      cartB.swingArm();
    });
    this.new_line();

    // GUI debug shortcuts
    this.live_string((elem) => {
      elem.textContent = "GUI Debug";
    });
    this.new_line();

    this.live_string((elem) => {
      elem.textContent = "Mix Controls";
    });
    this.new_line();
    this.key_triggered_button("master -", ["i"], () => {
      this.stepMasterVolume(-0.05);
    });
    this.key_triggered_button("master +", ["o"], () => {
      this.stepMasterVolume(0.05);
    });
    this.new_line();
    this.key_triggered_button("music -", ["j"], () => {
      this.stepMusicVolume(-0.05);
    });
    this.key_triggered_button("music +", ["k"], () => {
      this.stepMusicVolume(0.05);
    });
    this.new_line();
    this.key_triggered_button("sfx -", ["u"], () => {
      this.stepSfxVolume(-0.05);
    });
    this.key_triggered_button("sfx +", ["y"], () => {
      this.stepSfxVolume(0.05);
    });
    this.new_line();
    this.key_triggered_button("next track", ["p"], () => {
      this.cycleNormalTrack();
    });
    this.live_string((elem) => {
      elem.style.paddingLeft = "20px";
      elem.textContent = `master: ${Math.round(this.masterMixVolume * 100)}%`;
    });
    this.new_line();
    this.live_string((elem) => {
      elem.style.paddingLeft = "20px";
      elem.textContent = `music: ${Math.round(this.musicMixVolume * 100)}%`;
    });
    this.new_line();
    this.live_string((elem) => {
      elem.style.paddingLeft = "20px";
      elem.textContent = `sfx: ${Math.round(this.sfxMixVolume * 100)}%`;
    });
    this.new_line();
    this.live_string((elem) => {
      elem.style.paddingLeft = "20px";
      elem.textContent = `track: ${this.bgmTracks[this.bgmTrackIndex]?.label ?? "Unknown"}`;
    });
    this.new_line();

    // other shortcuts
    this.key_triggered_button("pause", ["p"], () => {
      this.physics.cartMSD.enable = !this.physics.cartMSD.enable;
      if (this.physics.cartMSD.enable) {
        this.applyMusicTargets({ force: true, fadeSeconds: 0.15 });
        this.sound.effects.sawBlade.carA.setVolume(
          bladeVolume * this.mixRegistry.getVolume("saw"),
        );
        this.sound.effects.sawBlade.carB.setVolume(
          bladeVolume * this.mixRegistry.getVolume("saw"),
        );
      } else {
        this.applyMusicTargets({ force: true, fadeSeconds: 0.15 });
        this.sound.effects.sawBlade.carA.setVolume(0);
        this.sound.effects.sawBlade.carB.setVolume(0);
      }
    });
    this.new_line();
    this.key_triggered_button("normal speed", ["v"], () => {
      this.globalProps.timeMultiplier = 1;
    });
    this.new_line();
    this.key_triggered_button("10x slow-mo", ["b"], () => {
      this.globalProps.timeMultiplier = 1 / 10;
    });
    this.key_triggered_button("100x slow-mo", ["n"], () => {
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
    this.key_triggered_button("hard reset", ["t"], () => {
      this.resetGame();
    });
    this.new_line();
    this.key_triggered_button("spawn explosion", ["x"], () => {
      this.spawnExplosion(math.vec3(0, 0.75, 0));
    });
  }

  spawnExplosion(
    position: math.Vector3,
    options?: {
      visual?: SpawnExplosionOptions;
      blastRadius?: number;
      blastImpulse?: number;
      blastVerticalScale?: number;
      withForce?: boolean;
      playSound?: boolean;
      soundVolume?: number;
    },
  ): void {
    this.drawables.explosionFx.spawn(position, options?.visual);
    if (options?.playSound ?? true) {
      this.sound.effects.explosion.play(options?.soundVolume ?? 1);
    }

    if (options?.withForce ?? true) {
      this.physics.cartMSD.applyRadialImpulse(position, {
        radius: options?.blastRadius,
        impulse: options?.blastImpulse,
        verticalScale: options?.blastVerticalScale,
      });
    }
  }
}
