import { math } from "../../tiny-graphics-math";
import {
  Integrator,
  MSDParticle,
  ParticleCollection,
  ParticleTags,
  SpringCollection,
  SpringDamperSystem,
  SymplecticEuler,
} from "./msdSystem";
import {
  affineTransform,
  basisChange,
  PlaneChoice,
  rotateAboutAxis,
  Vector2,
} from "../utils/math";
import { CartField, PlaneField } from "./contactFields";
import {
  curryDyn,
  sdOrientedCapsule2D,
  sdOrientedRect,
} from "../linearAlgebra/sdfs";
import { range } from "../utils/iterators";

export class CartFrame {
  msdSystem: SpringDamperSystem;
  integrator: Integrator;
  enable: boolean = false;
  timeStep: number = 0.001;
  private initial: {
    locations: math.Vector3[];
    carNodeCount: number;
  };
  private readonly dimensions: {
    frameWidth: number;
    wheelbase: number;
  };
  nodeRanges: {
    CarA: [number, number];
    CarB: [number, number];
  };

  constructor(props: {
    dimensions: {
      frameWidth: number;
      frameHeight: number;
      frameLength: number;
      wheelbase: number;
    };
    transforms?: {
      cartA: math.Mat4;
      cartB: math.Mat4;
    };
  }) {
    this.dimensions = {
      frameWidth: props.dimensions.frameWidth,
      wheelbase: props.dimensions.wheelbase,
    };
    this.initial = {
      locations: [],
      carNodeCount: 0,
    };
    props.transforms ??= {
      cartA: math.Mat4.identity(),
      cartB: math.Mat4.identity(),
    };

    const pMass = 3.6;
    const y_disp = 0.1;
    const particles = new ParticleCollection(0);
    const wx = props.dimensions.wheelbase / 2;
    const wx2 = props.dimensions.frameLength / 2;
    const wy = props.dimensions.frameHeight;
    const wy2 = wy * 0.5;
    const wy3 = wy2 * Math.SQRT1_2;
    const wz = props.dimensions.frameWidth / 2;
    const wz2 = wz * Math.SQRT1_2;

    // NOTE: if you add any new point to the car template, do it at the
    // very end. Code below relies on the order of the nodes to compute
    // tire forces and the change of basis for the mesh.

    // prettier-ignore
    const pArr: Array<[number, number, number, number, ParticleTags[]]> = [
      // floor nodes
      [ wx,    0,  wz, pMass, ["tire", "structural"]],
      [ wx,    0, -wz, pMass, ["tire", "structural"]],
      [-wx,    0, -wz, pMass, ["tire", "structural"]],
      [-wx,    0,  wz, pMass, ["tire", "structural"]],
      // mid section
      [ wx, wy/2,   0, pMass, ["structural"]],
      [  0, wy/2, -wz, pMass, ["structural"]],
      [-wx, wy/2,   0, pMass, ["structural"]],
      [  0, wy/2,  wz, pMass, ["structural"]],
      // top section
      [ wx,   wy,  wz, pMass, ["structural"]],
      [ wx,   wy, -wz, pMass, ["structural"]],
      [-wx,   wy, -wz, pMass, ["structural"]],
      [-wx,   wy,  wz, pMass, ["structural"]],
      // front bumper
      [ wx2, wy2 + wy3,  wz2, pMass, ["structural"]],
      [ wx2, wy2 + wy3, -wz2, pMass, ["structural"]],
      [ wx2, wy2 - wy3, -wz2, pMass, ["structural"]],
      [ wx2, wy2 - wy3,  wz2, pMass, ["structural"]],
      // rear bumper
      [-wx2, wy2 + wy3,  wz2, pMass, ["structural"]],
      [-wx2, wy2 + wy3, -wz2, pMass, ["structural"]],
      [-wx2, wy2 - wy3, -wz2, pMass, ["structural"]],
      [-wx2, wy2 - wy3,  wz2, pMass, ["structural"]],
    ];
    const carNodeCount = pArr.length;
    pArr.push(...pArr); // car B is identical

    // If you need to add more particles (free or clusters), do it HERE.
    // If you add particles before this line you will break the fixed
    // distance between cars which is assumed to be true throughout this
    // module.

    particles.container = pArr.map(([x, y, z, m, tags]) => {
      const p = new MSDParticle({
        mass: m,
        location: math.vec3(x, y + y_disp, z),
        velocity: math.vec3(0, 0, 0),
      });
      p.tags = new Set(tags);
      return p;
    });

    // refer to expression 33 and 47 of this graph for springs
    // https://www.desmos.com/3d/yuzllbjcyx

    // prettier-ignore
    const pairs: Array<[number, number]> = [
      [0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3],
      [0, 4], [0, 7], [0, 8], [1, 4], [1, 5], [1, 9],
      [2, 5], [2, 6], [2, 10], [3, 6], [3, 7], [3, 11],
      [8, 4], [8, 7], [9, 4], [9, 5], [10, 5], [10, 6],
      [11, 6], [11, 7], [8, 9], [9, 10], [10, 11], [11, 8],
      [8, 10], [9, 11], [4, 5], [5, 6], [6, 7], [7, 4],
      [4, 6], [5, 7], [0, 10], [1, 11], [2, 8], [3, 9],
      [4, 12], [4, 13], [4, 14], [4, 15], [6, 16], [6, 17],
      [6, 18], [6, 19], [12, 13], [13, 14], [14, 15], [15, 12],
      [16, 17], [17, 18], [18, 19], [19, 16], [12, 0], [12, 8],
      [12, 9], [13, 1], [13, 8], [13, 9], [14, 0], [14, 1],
      [14, 9], [15, 1], [15, 0], [15, 8], [16, 3], [16, 10],
      [16, 11], [17, 2], [17, 10], [17, 11], [18, 2], [18, 3],
      [18, 10], [19, 3], [19, 2], [19, 11], [12, 2], [12, 3],
      [12, 10], [12, 11], [13, 2], [13, 3], [13, 10], [13, 11],
      [14, 2], [14, 3], [14, 10], [14, 11], [15, 2], [15, 3],
      [15, 10], [15, 11], [16, 0], [16, 1], [16, 8], [16, 9],
      [17, 0], [17, 1], [17, 8], [17, 9], [18, 0], [18, 1],
      [18, 8], [18, 9], [19, 0], [19, 1], [19, 8], [19, 9],
    ];
    pairs.push(
      ...pairs.map(
        ([x, y]) => [x + carNodeCount, y + carNodeCount] as [number, number],
      ),
    );

    const springs = new SpringCollection(pairs.length);
    springs.container.forEach((sp) => {
      sp.reset({
        kSpring: 5000,
        kDamper: 240,
        length: 1,
      });
    });

    // create MSD simulator
    this.msdSystem = new SpringDamperSystem(
      springs,
      particles,
      math.vec3(0, -9.8, 0),
    );

    // add particles to their appropriate groups
    for (const i of range(carNodeCount)) {
      this.msdSystem.addParticleToGroup(particles.container[i], "CarA");
    }
    for (const i of range(carNodeCount, carNodeCount * 2)) {
      this.msdSystem.addParticleToGroup(particles.container[i], "CarB");
    }

    // apply initial transform to all particles.
    for (const p of this.msdSystem.getGroup("CarA")) {
      p.location = math.vec3(
        ...affineTransform(props.transforms.cartA, p.location, 1),
      );
    }
    for (const p of this.msdSystem.getGroup("CarB")) {
      p.location = math.vec3(
        ...affineTransform(props.transforms.cartB, p.location, 1),
      );
    }

    // link particles with beams and set length
    pairs.forEach(([i1, i2], i) => {
      springs.container[i].length = particles.container[i1].location
        .minus(particles.container[i2].location)
        .norm();
      this.msdSystem.makeLink(i, [i1, i2]);
    });

    const plChoice: PlaneChoice = "xz";
    // adjust as needed to improve node enclosure
    const pillLength = wx2 * 1.0;
    const pillWidth = props.dimensions.frameWidth;

    // this pattern is a clusterfuck ngl, but it is a necessary evil. It
    // pushes the "contact fields" which are the colliders in the game,
    // and allows them to manage an internal signed distance function
    // and it's derivative. Trust me... this could have been way uglier.
    this.msdSystem.contactFields.push(
      new PlaneField(new Set(), math.vec3(0, 1, 0), {
        stiffness: 15000,
        damping: 10,
        friction: {
          kinetic: 0.9,
          static: 1,
          threshold: 1e-3,
        },
        restitution: {
          coefficient: 0.2,
        },
        height: 0,
      }),
      new CartField(
        new Set(["CarB"]), // affects CarB but follows CarA
        curryDyn(sdOrientedRect, () => {
          // this line is implicitly getting orientation of CarA
          const dir = this.getOrientation();
          const rear = Vector2.from3d(
            dir.mid.minus(dir.fwd.times(pillLength)),
            plChoice,
          );
          const front = Vector2.from3d(
            dir.mid.plus(dir.fwd.times(pillLength)),
            plChoice,
          );

          return [rear, front, pillWidth, plChoice];
        }),
        {
          stiffness: 15000,
          damping: 10,
          restitution: {
            coefficient: 0.8,
          },
        },
      ),
      new CartField(
        new Set(["CarA"]), // affects CarA but follows CarB
        curryDyn(sdOrientedRect, () => {
          // this line is getting orientation of CarB (hence the shift
          // by carNodeCount)
          const dir = this.getOrientation(carNodeCount);
          const rear = Vector2.from3d(
            dir.mid.minus(dir.fwd.times(pillLength)),
            plChoice,
          );
          const front = Vector2.from3d(
            dir.mid.plus(dir.fwd.times(pillLength)),
            plChoice,
          );

          return [rear, front, pillWidth, plChoice];
        }),
        {
          stiffness: 15000,
          damping: 10,
          restitution: {
            coefficient: 0.8,
          },
        },
      ),
    );

    // this was the best performing one
    this.integrator = new SymplecticEuler();

    // this saves the state for resetting purposes
    this.initial.locations = particles.container.map((p) => p.location);
    this.initial.carNodeCount = carNodeCount;
    this.nodeRanges = {
      CarA: [0, carNodeCount - 1],
      CarB: [carNodeCount, carNodeCount * 2 - 1],
    };

    this.updateTireVectors(0, 0, 0, 0);
  }

  resetState() {
    const pcs = this.msdSystem.particles.container;
    const pCount = pcs.length;
    for (let i = 0; i < pCount; ++i) {
      pcs[i].location = this.initial.locations[i].copy();
      pcs[i].velocity = math.vec3(0, 0, 0);
    }
  }

  private averageBumperFront(sh: number = 0) {
    //0 1 8 9 12 13 14 15
    const [i0, i1, i2, i3] = [12, 13, 14, 15];
    const pc = this.msdSystem.particles.container;
    const x =
      (pc[i0 + sh].location[0] +
        pc[i1 + sh].location[0] +
        pc[i2 + sh].location[0] +
        pc[i3 + sh].location[0]) /
      4;
    const y =
      (pc[i0 + sh].location[1] +
        pc[i1 + sh].location[1] +
        pc[i2 + sh].location[1] +
        pc[i3 + sh].location[1]) /
      4;
    const z =
      (pc[i0 + sh].location[2] +
        pc[i1 + sh].location[2] +
        pc[i2 + sh].location[2] +
        pc[i3 + sh].location[2]) /
      4;
    return math.vec3(x, y, z);
  }

  private averageBumperRear(sh: number = 0) {
    // 2 3 10 11 16 17 18 19
    const [i0, i1, i2, i3] = [16, 17, 18, 19];
    const pc = this.msdSystem.particles.container;
    const x =
      (pc[i0 + sh].location[0] +
        pc[i1 + sh].location[0] +
        pc[i2 + sh].location[0] +
        pc[i3 + sh].location[0]) /
      4;
    const y =
      (pc[i0 + sh].location[1] +
        pc[i1 + sh].location[1] +
        pc[i2 + sh].location[1] +
        pc[i3 + sh].location[1]) /
      4;
    const z =
      (pc[i0 + sh].location[2] +
        pc[i1 + sh].location[2] +
        pc[i2 + sh].location[2] +
        pc[i3 + sh].location[2]) /
      4;
    return math.vec3(x, y, z);
  }

  getAverage(nodeRange: [number, number]) {
    const [a, b] = nodeRange;
    let x = 0;
    let y = 0;
    let z = 0;
    for (let i = a; i < b; ++i) {
      const loc = this.msdSystem.particles.container[i].location;
      x += loc[0];
      y += loc[1];
      z += loc[2];
    }
    x /= b - a;
    y /= b - a;
    z /= b - a;
    return math.vec3(x, y, z);
  }

  getBoundingBox(nodeRange: [number, number]) {
    const [a, b] = nodeRange;
    let xm: number | undefined;
    let ym: number | undefined;
    let zm: number | undefined;
    let xM: number | undefined;
    let yM: number | undefined;
    let zM: number | undefined;
    for (let i = a; i < b; ++i) {
      const loc = this.msdSystem.particles.container[i].location;
      xm ??= loc[0];
      ym ??= loc[1];
      zm ??= loc[2];
      xM ??= loc[0];
      yM ??= loc[1];
      zM ??= loc[2];

      xm = loc[0] < xm ? loc[0] : xm;
      ym = loc[1] < ym ? loc[1] : ym;
      zm = loc[2] < zm ? loc[2] : zm;
      xM = loc[0] > xM ? loc[0] : xM;
      yM = loc[1] > yM ? loc[1] : yM;
      zM = loc[2] > zM ? loc[2] : zM;
    }
    return {
      min: math.vec3(xm!, ym!, zm!),
      max: math.vec3(xM!, yM!, zM!),
    };
  }

  getTransforms() {
    const pc = this.msdSystem.particles.container;
    const sh = this.initial.carNodeCount;
    const shRoof = 8; // tires + 8 -> roof index (assumes a box)
    const [i0, i1, i2, i3] = [0, 1, 2, 3];
    const [j0, j1, j2, j3] = [i0 + sh, i1 + sh, i2 + sh, i3 + sh];

    const Ma = basisChange(
      pc[i3].location.plus(pc[i3 + shRoof].location).times(0.5),
      pc[i2].location.plus(pc[i2 + shRoof].location).times(0.5),
      pc[i1].location.plus(pc[i1 + shRoof].location).times(0.5),
      pc
        .slice(0, 4)
        .map((p) => p.location)
        .reduce((acc, cv) => acc.plus(cv))
        .times(1 / 4),
    );

    const Mb = basisChange(
      pc[j3].location.plus(pc[j3 + shRoof].location).times(0.5),
      pc[j2].location.plus(pc[j2 + shRoof].location).times(0.5),
      pc[j1].location.plus(pc[j1 + shRoof].location).times(0.5),
      pc
        .slice(0 + sh, 4 + sh)
        .map((p) => p.location)
        .reduce((acc, cv) => acc.plus(cv))
        .times(1 / 4),
    );

    return {
      mtxCarA: Ma,
      mtxCarB: Mb,
    };
  }

  getOrientation(sh: number = 0) {
    const pc = this.msdSystem.particles.container;
    const [i0, i1, i2, i3] = [0 + sh, 1 + sh, 2 + sh, 3 + sh];
    return {
      fwd: pc[i1].location.minus(pc[i2].location).normalized(),
      side: pc[i3].location.minus(pc[i2].location).normalized(),
      mid: this.getAverage([i0, i3 + 1]),
    };
  }

  updateTireVectors(
    angleA: number,
    thrustA: number,
    angleB: number,
    thrustB: number,
  ) {
    const pc = this.msdSystem.particles.container;

    const out: {
      frontLeft: number;
      frontRight: number;
    }[] = [];

    const foo: Array<[number, number, number]> = [
      [0, angleA, thrustA],
      [this.initial.carNodeCount, angleB, thrustB],
    ];

    for (const [sh, angle, thrust] of foo) {
      const [i0, i1, i2, i3, i4] = [0 + sh, 1 + sh, 2 + sh, 3 + sh, 8 + sh];
      const upVec = pc[i0].location.minus(pc[i4].location).normalized();
      const fwdVec = pc[i1].location.minus(pc[i2].location).normalized();
      const innerAngle = angle;
      const outerAngle =
        Math.sign(innerAngle) *
        Math.atan(
          this.dimensions.wheelbase /
            (this.dimensions.frameWidth +
              this.dimensions.wheelbase / Math.tan(Math.abs(innerAngle))),
        );
      let frontLeft;
      let frontRight;
      if (Math.abs(innerAngle) < 1e-6) {
        frontLeft = 0;
        frontRight = 0;
      } else {
        frontLeft = innerAngle < 0 ? innerAngle : outerAngle;
        frontRight = innerAngle < 0 ? outerAngle : innerAngle;
      }
      out.push({
        frontLeft,
        frontRight,
      });

      // rear tires
      pc[i2].tireForward = fwdVec;
      pc[i2].tireThrust = thrust;
      pc[i3].tireForward = fwdVec;
      pc[i3].tireThrust = thrust;

      // front tires
      pc[i0].tireForward = rotateAboutAxis(
        fwdVec,
        upVec,
        frontLeft,
      ).normalized();
      pc[i0].tireThrust = thrust;
      pc[i1].tireForward = rotateAboutAxis(
        fwdVec,
        upVec,
        frontRight,
      ).normalized();
      pc[i1].tireThrust = thrust;
    }

    return {
      CarA: out[0],
      CarB: out[1],
    };
  }

  getTireGroundSpeed() {
    const pc = this.msdSystem.particles.container;
    const sh = this.initial.carNodeCount;
    const [i0, i1, i2, i3] = [0, 1, 2, 3];
    const [j0, j1, j2, j3] = [i0 + sh, i1 + sh, i2 + sh, i3 + sh];
    const fwdA = pc[i1].location.minus(pc[i2].location).normalized();
    const fwdB = pc[j1].location.minus(pc[j2].location).normalized();

    return {
      CarA: {
        frontRight: pc[i0].velocity.dot(pc[i0].tireForward ?? fwdA),
        frontLeft: pc[i1].velocity.dot(pc[i1].tireForward ?? fwdA),
        rearLeft: pc[i2].velocity.dot(pc[i2].tireForward ?? fwdA),
        rearRight: pc[i3].velocity.dot(pc[i3].tireForward ?? fwdA),
      },
      CarB: {
        frontRight: pc[j0].velocity.dot(pc[j0].tireForward ?? fwdB),
        frontLeft: pc[j1].velocity.dot(pc[j1].tireForward ?? fwdB),
        rearLeft: pc[j2].velocity.dot(pc[j2].tireForward ?? fwdB),
        rearRight: pc[j3].velocity.dot(pc[j3].tireForward ?? fwdB),
      },
    };
  }
}
