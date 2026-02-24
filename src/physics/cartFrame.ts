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
  Vector2,
} from "../utils/math";
import { CartField, PlaneField } from "./contactFields";
import { curryDyn, sdOrientedPillExt } from "../linearAlgebra/sdfs";
import { range } from "../utils/iterators";

export class CartFrame {
  msdSystem: SpringDamperSystem;
  integrator: Integrator;
  enable: boolean = false;
  timeStep: number = 0.001;
  private initial: {
    locations: math.Vector3[];
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
    this.initial = {
      locations: [],
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
    // prettier-ignore
    const pArr: Array<[number, number, number, number, ParticleTags[]]> = [
      // floor nodes
      [ wx,    0,  wz, pMass, ["tire"]],
      [ wx,    0, -wz, pMass, ["tire"]],
      [-wx,    0, -wz, pMass, ["tire"]],
      [-wx,    0,  wz, pMass, ["tire"]],
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

    particles.container = pArr.map(([x, y, z, m, tags]) => {
      const p = new MSDParticle({
        mass: m,
        location: math.vec3(x, y + y_disp, z),
        velocity: math.vec3(0, 0, 0),
      });
      p.tags = new Set(tags);
      return p;
    });

    const pairs: Array<[number, number]> = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [0, 2],
      [1, 3],
      [0, 4],
      [0, 7],
      [0, 8],
      [1, 4],
      [1, 5],
      [1, 9],
      [2, 5],
      [2, 6],
      [2, 10],
      [3, 6],
      [3, 7],
      [3, 11],
      [8, 4],
      [8, 7],
      [9, 4],
      [9, 5],
      [10, 5],
      [10, 6],
      [11, 6],
      [11, 7],
      [8, 9],
      [9, 10],
      [10, 11],
      [11, 8],
      [8, 10],
      [9, 11],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
      [4, 6],
      [5, 7],
      [0, 10],
      [1, 11],
      [2, 8],
      [3, 9],
      [4, 12],
      [4, 13],
      [4, 14],
      [4, 15],
      [6, 16],
      [6, 17],
      [6, 18],
      [6, 19],
      [12, 13],
      [13, 14],
      [14, 15],
      [15, 12],
      [16, 17],
      [17, 18],
      [18, 19],
      [19, 16],
      [12, 0],
      [12, 8],
      [12, 9],
      [13, 1],
      [13, 8],
      [13, 9],
      [14, 0],
      [14, 1],
      [14, 9],
      [15, 1],
      [15, 0],
      [15, 8],
      [16, 3],
      [16, 10],
      [16, 11],
      [17, 2],
      [17, 10],
      [17, 11],
      [18, 2],
      [18, 3],
      [18, 10],
      [19, 3],
      [19, 2],
      [19, 11],
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
        kDamper: 120,
        length: 1,
      });
    });

    this.msdSystem = new SpringDamperSystem(
      springs,
      particles,
      math.vec3(0, -9.8, 0),
      // {
      //   coefRestitution: 0.2,
      //   coefKFriction: 0.5,
      //   coefSFriction: 0.7,
      // },
    );

    for (const i of range(carNodeCount)) {
      this.msdSystem.addParticleToGroup(particles.container[i], "CarA");
    }
    for (const i of range(carNodeCount, carNodeCount * 2)) {
      this.msdSystem.addParticleToGroup(particles.container[i], "CarB");
    }

    for (const p of this.msdSystem.getGroup("CarA")) {
      p.location = math.vec3(
        ...affineTransform(props.transforms.cartA, p.location, 1),
      );
      // p.location[2] += 2;
      // p.velocity[2] -= 2;
    }
    for (const p of this.msdSystem.getGroup("CarB")) {
      p.location = math.vec3(
        ...affineTransform(props.transforms.cartB, p.location, 1),
      );
    }

    pairs.forEach(([i1, i2], i) => {
      springs.container[i].length = particles.container[i1].location
        .minus(particles.container[i2].location)
        .norm();
      this.msdSystem.makeLink(i, [i1, i2]);
    });

    const plChoice: PlaneChoice = "xz";

    this.msdSystem.contactFields.push(
      new PlaneField(new Set(), math.vec3(0, 1, 0), {
        stiffness: 15000,
        damping: 10,
        // friction: {
        //   kinetic: 0.5,
        //   static: 0.7,
        //   threshold: 1e-3,
        // },
        restitution: {
          coefficient: 0.2,
        },
        height: 0,
      }),
      new CartField(
        new Set(["CarB"]),
        curryDyn(sdOrientedPillExt, () => {
          const front = this.averageBumperFront();
          const rear = this.averageBumperRear();
          const center = front.plus(rear);
          center.scale_by(0.5);
          front.subtract_by(rear);
          front.normalize();
          front.scale_by(wx2);

          return [
            Vector2.from3d(center.plus(front), plChoice),
            Vector2.from3d(center.minus(front), plChoice),
            wz, // frame width
            plChoice,
          ];
        }),
        {
          stiffness: 15000,
          damping: 10,
          // friction: {
          //   kinetic: 0.5,
          //   static: 0.7,
          //   threshold: 1e-3,
          // },
          restitution: {
            coefficient: 1,
          },
          height: 0,
        },
      ),
      new CartField(
        new Set(["CarA"]),
        curryDyn(sdOrientedPillExt, () => {
          const front = this.averageBumperFront(carNodeCount);
          const rear = this.averageBumperRear(carNodeCount);
          const center = front.plus(rear);
          center.scale_by(0.5);
          front.subtract_by(rear);
          front.normalize();
          front.scale_by(wx2);

          return [
            Vector2.from3d(center.plus(front), plChoice),
            Vector2.from3d(center.minus(front), plChoice),
            wz, // frame width
            plChoice,
          ];
        }),
        {
          stiffness: 15000,
          damping: 10,
          // friction: {
          //   kinetic: 0.5,
          //   static: 0.7,
          //   threshold: 1e-3,
          // },
          restitution: {
            coefficient: 1,
          },
          height: 0,
        },
      ),
    );

    this.integrator = new SymplecticEuler();

    // this.should always happen last
    this.initial.locations = particles.container.map((p) => p.location);
  }

  resetState() {
    const pcs = this.msdSystem.particles.container;
    const pCount = pcs.length;
    for (let i = 0; i < pCount; ++i) {
      pcs[i].location = this.initial.locations[i].copy();
      pcs[i].velocity = math.vec3(0, 0, 0);
      // if (pcs[i].group === "CarA") {
      //   pcs[i].velocity[2] -= 10;
      // }
    }
  }

  private averageBumperFront(sh: number = 0) {
    //0 1 8 9 12 13 14 15
    const pc = this.msdSystem.particles.container;
    const x =
      (pc[0 + sh].location[0] +
        pc[1 + sh].location[0] +
        pc[8 + sh].location[0] +
        pc[9 + sh].location[0]) /
      4;
    const y =
      (pc[0 + sh].location[1] +
        pc[1 + sh].location[1] +
        pc[8 + sh].location[1] +
        pc[9 + sh].location[1]) /
      4;
    const z =
      (pc[0 + sh].location[2] +
        pc[1 + sh].location[2] +
        pc[8 + sh].location[2] +
        pc[9 + sh].location[2]) /
      4;
    return math.vec3(x, y, z);
  }

  private averageBumperRear(sh: number = 0) {
    // 2 3 10 11 16 17 18 19
    const pc = this.msdSystem.particles.container;
    const x =
      (pc[2 + sh].location[0] +
        pc[3 + sh].location[0] +
        pc[10 + sh].location[0] +
        pc[11 + sh].location[0]) /
      4;
    const y =
      (pc[2 + sh].location[1] +
        pc[3 + sh].location[1] +
        pc[10 + sh].location[1] +
        pc[11 + sh].location[1]) /
      4;
    const z =
      (pc[2 + sh].location[2] +
        pc[3 + sh].location[2] +
        pc[10 + sh].location[2] +
        pc[11 + sh].location[2]) /
      4;
    return math.vec3(x, y, z);
  }

  getTransforms() {
    const pc = this.msdSystem.particles.container;
    const shift = pc.length / 2;
    let [i1, i2, i3] = [3, 2, 1];

    const Ma = basisChange(
      pc[i1].location.plus(pc[i1].location).times(0.5),
      pc[i2].location.plus(pc[i2].location).times(0.5),
      pc[i3].location.plus(pc[i3].location).times(0.5),
      pc
        .slice(0, 4)
        .map((p) => p.location)
        .reduce((acc, cv) => acc.plus(cv))
        .times(1 / 4),
    );
    i1 += shift;
    i2 += shift;
    i3 += shift;

    const Mb = basisChange(
      pc[i1].location.plus(pc[i1 + 8].location).times(0.5),
      pc[i2].location.plus(pc[i2 + 8].location).times(0.5),
      pc[i3].location.plus(pc[i3 + 8].location).times(0.5),
      pc
        .slice(0 + shift, 4 + shift)
        .map((p) => p.location)
        .reduce((acc, cv) => acc.plus(cv))
        .times(1 / 4),
    );

    return {
      mtxCarA: Ma,
      mtxCarB: Mb,
    };
  }
}
