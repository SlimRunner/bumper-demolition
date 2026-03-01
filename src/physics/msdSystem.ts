import { range } from "../utils/iterators";
import { math } from "../../tiny-graphics-math";
import { getOrInsertCond } from "../utils/polyfills";
import { ContactField } from "./contactFields";

type ParticleProperties = {
  mass: number;
  location: math.Vector3;
  velocity: math.Vector3;
};

type SpringProperties = {
  kSpring: number;
  kDamper: number;
  length: number;
};

export type ParticleTags = "tire" | "structural" | "kinematic";

export interface Collection<T> {
  container: T[];
}

export class MSDParticle {
  mass: number;
  location: math.Vector3;
  velocity: math.Vector3;
  prevLocation?: math.Vector3;
  tireForward?: math.Vector3;
  tireThrust?: number;

  tags: Set<ParticleTags>;
  group?: string;

  constructor(props: Partial<ParticleProperties> = {}) {
    this.mass = props.mass ?? 0;
    this.location = props.location ?? math.vec3(0, 0, 0);
    this.velocity = props.velocity ?? math.vec3(0, 0, 0);
    this.tags = new Set();
  }

  reset(props: ParticleProperties) {
    this.mass = props.mass;
    this.location = props.location;
    this.velocity = props.velocity;
  }
}

export class MSDSpring {
  kSpring: number;
  kDamper: number;
  length: number;

  constructor(props: Partial<SpringProperties> = {}) {
    this.kSpring = props.kSpring ?? 0;
    this.kDamper = props.kDamper ?? 0;
    this.length = props.length ?? 0;
  }

  reset(props: SpringProperties) {
    this.kSpring = props.kSpring;
    this.kDamper = props.kDamper;
    this.length = props.length;
  }
}

export class ParticleCollection implements Collection<MSDParticle> {
  container: MSDParticle[];

  constructor(count: number) {
    this.container = Array.from(range(count)).map((_) => new MSDParticle());
  }
}

export class SpringCollection implements Collection<MSDSpring> {
  container: MSDSpring[];

  constructor(count: number) {
    this.container = Array.from(range(count)).map((_) => new MSDSpring());
  }
}

export class SpringDamperSystem {
  springs: SpringCollection;
  particles: ParticleCollection;
  links: Map<MSDSpring, [MSDParticle, MSDParticle]>;
  constAccel: math.Vector3;
  contactFields: ContactField[];

  particleGroups: Map<string, Set<MSDParticle>>;

  constructor(
    springs: SpringCollection,
    particles: ParticleCollection,
    constAccel: math.Vector3,
  ) {
    this.springs = springs;
    this.particles = particles;
    this.links = new Map();
    this.constAccel = constAccel;
    this.particleGroups = new Map();
    this.contactFields = [];
  }

  resetLinks() {
    this.links = new Map();
  }

  makeLink(springIndex: number, particleIndices: [number, number]) {
    const spring = this.springs.container[springIndex];
    const particle1 = this.particles.container[particleIndices[0]];
    const particle2 = this.particles.container[particleIndices[1]];
    this.links.set(spring, [particle1, particle2]);
  }

  addParticleToGroup(p: MSDParticle, group: string) {
    p.group = group;

    if (!this.particleGroups.has(group)) {
      this.particleGroups.set(group, new Set());
    }

    this.particleGroups.get(group)!.add(p);
  }

  addTag(p: MSDParticle, tag: ParticleTags) {
    p.tags.add(tag);
  }

  getParticlesWithTag(tag: ParticleTags): MSDParticle[] {
    return this.particles.container.filter((p) => p.tags.has(tag));
  }

  getGroup(group: string): MSDParticle[] {
    return Array.from(this.particleGroups.get(group) ?? []);
  }

  computeForces() {
    const forces = new Map<MSDParticle, math.Vector3>();
    // const velThreshold = this.params.kFrictionThres;

    for (const [spring, [p1, p2]] of this.links) {
      const delta = p2.location.minus(p1.location);
      const beamDist = delta.norm();
      const beamDir = delta.normalized();

      const stretch = beamDist - spring.length;

      const relativeVelocity = p2.velocity.minus(p1.velocity);
      const damper = relativeVelocity.dot(beamDir);

      const forceMagnitude = spring.kSpring * stretch + spring.kDamper * damper;
      const finalForce = beamDir.times(forceMagnitude);

      const f1 = getOrInsertCond(forces, p1, () => math.vec3(0, 0, 0));
      const f2 = getOrInsertCond(forces, p2, () => math.vec3(0, 0, 0));

      forces.set(p1, f1.plus(finalForce));
      forces.set(p2, f2.minus(finalForce));
    }

    for (const p of this.particles.container) {
      if (p.tags.has("kinematic")) continue;
      let FNet = getOrInsertCond(forces, p, () => math.vec3(0, 0, 0)).plus(
        this.constAccel.times(p.mass),
      );

      for (const field of this.contactFields) {
        // apply contact forces
        if (field.affects(p)) {
          const dist = field.sdf(p.location);
          const normal = field.normal(p.location);
          const normalForce = normal.times(normal.dot(FNet));

          if (dist < 0) {
            const normSpeed = p.velocity.dot(normal);
            const normVelocity = normal.times(normSpeed);
            const tangVelocity = p.velocity.minus(normVelocity);
            // penetration happened
            // if (field.friction) {
            //   // compute tangential friction forces
            //   if (tangVelocity.norm() < field.friction.threshold) {
            //     // static
            //     const muS = field.friction.static;
            //     const fmax = normalForce.norm() * muS;

            //     p.velocity = normVelocity;
            //   } else {
            //     // kinetic
            //   }
            // }
            if (field.restitution && normSpeed < 0) {
              const restitution = normal.times(
                normSpeed * (1 + field.restitution.coefficient),
              );
              p.velocity = p.velocity.minus(restitution);
            }

            const msdForce = normal.times(
              field.stiffness * dist + field.damping * normSpeed,
            );
            FNet = FNet.minus(msdForce);
          }
        }
      }

      forces.set(p, FNet);
    }

    return forces;
  }
}

export interface Integrator {
  step(system: SpringDamperSystem, dt: number): void;
}

export class ForwardEuler implements Integrator {
  step(system: SpringDamperSystem, dt: number): void {
    const forces = system.computeForces();

    for (const p of system.particles.container) {
      if (p.tags.has("kinematic")) continue;
      let acc = forces.get(p)!.times(1 / p.mass);

      p.location = p.location.plus(p.velocity.times(dt));
      p.velocity = p.velocity.plus(acc.times(dt));
    }
  }
}

export class SymplecticEuler implements Integrator {
  step(system: SpringDamperSystem, dt: number) {
    const forces = system.computeForces();

    for (const p of system.particles.container) {
      if (p.tags.has("kinematic")) continue;
      const a = forces.get(p)!.times(1 / p.mass);

      const newVel = p.velocity.plus(a.times(dt));
      if (newVel.every(n => !Number.isNaN(n))) {
        p.velocity = newVel;
      } else {
        console.warn(["NAN vel in integrator", newVel])
      }
      const newLoc = p.location.plus(p.velocity.times(dt));
      if (newLoc.every(n => !Number.isNaN(n))) {
        p.location = newLoc;
      } else {
        console.warn(["NAN loc in integrator", newLoc])
      }
    }
  }
}

export class Verlet implements Integrator {
  step(system: SpringDamperSystem, dt: number) {
    const forces = system.computeForces();

    for (const p of system.particles.container) {
      if (p.tags.has("kinematic")) continue;
      if (!p.prevLocation) {
        p.prevLocation = p.location.minus(p.velocity.times(dt));
      }

      const a = forces.get(p)!.times(1 / p.mass);

      const next = p.location
        .times(2)
        .minus(p.prevLocation)
        .plus(a.times(dt * dt));

      p.prevLocation = p.location;
      p.location = next;

      p.velocity = next.minus(p.prevLocation).times(1 / dt);
    }
  }
}
