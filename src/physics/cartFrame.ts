import { range } from "src/utils/iterators";
import { math } from "../../tiny-graphics-math";
import {
  Integrator,
  MSDParticle,
  ParticleCollection,
  SpringCollection,
  SpringDamperSystem,
  SymplecticEuler,
} from "./msdSystem";

export class CartFrame {
  msdSystem: SpringDamperSystem;
  integrator: Integrator;
  enable: boolean = false;
  timeStep: number = 0.001;

  constructor(props: {
    dimensions: {
      wheelbase: number;
      axleTrack: number;
      frameWidth: number;
      frameHeight: number;
      frameLength: number;
    };
  }) {
    const y_disp = 1;
    const particles = new ParticleCollection(0);
    const wx = props.dimensions.wheelbase / 2;
    const wz = props.dimensions.axleTrack / 2;
    particles.container = [
      // Cart A
      [wx, y_disp, wz, 50],
      [wx, y_disp, -wz, 50],
      [-wx, y_disp, -wz, 50],
      [-wx, y_disp, wz, 50],
      [0, wx + y_disp, 0, 0.1],

      // Cart B
      [wx, y_disp, wz, 50],
      [wx, y_disp, -wz, 50],
      [-wx, y_disp, -wz, 50],
      [-wx, y_disp, wz, 50],
      [0, wx + y_disp, 0, 0.1],
    ].map(
      ([x, y, z, m], i) =>
        new MSDParticle({
          mass: m,
          location: math.vec3(x, y, z + 2),
          velocity: math.vec3(0, 0, 0),
        }),
    );

    const pairs: Array<[number, number]> = [
      // Cart A
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [0, 2],
      [1, 3],
      [0, 4],
      [1, 4],
      [2, 4],
      [3, 4],

      // Cart B
      [5, 6],
      [6, 7],
      [7, 8],
      [8, 5],
      [5, 7],
      [6, 8],
      [5, 9],
      [6, 9],
      [7, 9],
      [8, 9],
    ];

    const springs = new SpringCollection(pairs.length);
    springs.container.forEach((sp) => {
      sp.reset({
        kSpring: 5000,
        kDamper: 40,
        length: 1,
      });
    });

    this.msdSystem = new SpringDamperSystem(
      springs,
      particles,
      math.vec3(0, -9.8, 0),
      {
        coefRestitution: 0.2,
        coefKFriction: 0.5,
        coefSFriction: 0.7,
      },
    );

    for (const i of [0, 1, 2, 3]) {
      this.msdSystem.addParticleToGroup(particles.container[i], "CarA");
      this.msdSystem.addTag(particles.container[i], "tire");
    }
    for (const i of [4]) {
      this.msdSystem.addParticleToGroup(particles.container[i], "CarA");
      this.msdSystem.addTag(particles.container[i], "structural");
    }
    for (const i of [5, 6, 7, 8]) {
      this.msdSystem.addParticleToGroup(particles.container[i], "CarB");
      this.msdSystem.addTag(particles.container[i], "tire");
    }
    for (const i of [9]) {
      this.msdSystem.addParticleToGroup(particles.container[i], "CarB");
      this.msdSystem.addTag(particles.container[i], "structural");
    }
    // this.msdSystem.addTag(particles.container[4], "kinematic");

    for (const p of this.msdSystem.getGroup("CarB")) {
      p.location[1] += 2
      p.location[2] -= 4
    }

    pairs.forEach(([i1, i2], i) => {
      springs.container[i].length = particles.container[i1].location
        .minus(particles.container[i2].location)
        .norm();
      this.msdSystem.makeLink(i, [i1, i2]);
    });

    this.integrator = new SymplecticEuler();
  }
}
