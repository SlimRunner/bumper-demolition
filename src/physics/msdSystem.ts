import { range } from "../utils/iterators";
import { math } from "../../tiny-graphics-math";
import { getOrInsertCond } from "../utils/polyfills";
import {
  ContactField,
  ImpulseRestitution,
  ReactiveTraction,
  TangentialFriction,
} from "./contactFields";
import { clamp, crossMut, projMut, setVector } from "../utils/math";

// function helpers to speed up the physics loop. They are way to
// specific to be put in utils.

// reference: https://stackoverflow.com/a/59906630
type ArrayLengthMutationKeys =
  | "splice"
  | "push"
  | "pop"
  | "shift"
  | "unshift"
  | number;
type ArrayItems<T extends Array<any>> =
  T extends Array<infer TItems> ? TItems : never;
type FixedLengthArray<T extends any[]> = Pick<
  T,
  Exclude<keyof T, ArrayLengthMutationKeys>
> & { [Symbol.iterator]: () => IterableIterator<ArrayItems<T>> };

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

// - tire: uses slip-angle friction model
// - regular: reserved for future use
// - kinematic: ignores all forces and fields
// - free: ignores all forces but tracks field penetrations
export type ParticleTags = "tire" | "regular" | "kinematic" | "free";

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
  disabled: boolean = false;
  metadata?: unknown;
  contactOverrides?: {
    traction?: ReactiveTraction;
    friction?: TangentialFriction;
    restitution?: ImpulseRestitution;
  };

  tags: Set<ParticleTags>;
  group: Set<string>;
  force: math.Vector3 = math.vec3(0, 0, 0);

  constructor(props: Partial<ParticleProperties> = {}) {
    this.mass = props.mass ?? 0;
    this.location = props.location ?? math.vec3(0, 0, 0);
    this.velocity = props.velocity ?? math.vec3(0, 0, 0);
    this.tags = new Set();
    this.group = new Set();
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
  trespassCB: (p: MSDParticle, f: ContactField) => void = () => {};

  // invoked every time a non-free particle is pushed by a contact
  // field. the third argument is the magnitude of the normal force that
  // was computed for that particle / contact pair.  (positive =
  // compressive) callers can integrate this over time to derive an
  // impulse or use it directly for instantaneous effects.
  collisionCB?: (p: MSDParticle, f: ContactField, forceMag: number) => void;

  cache: {
    // this pattern makes size and accesses static (i.e. you cannot use
    // an index of type number). Arbitrarily 10
    tempVec: FixedLengthArray<
      [
        math.Vector3,
        math.Vector3,
        math.Vector3,
        math.Vector3,
        math.Vector3,
        math.Vector3,
        math.Vector3,
        math.Vector3,
        math.Vector3,
        math.Vector3,
      ]
    >;
  };

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
    this.cache = {
      tempVec: [
        math.vec3(0, 0, 0),
        math.vec3(0, 0, 0),
        math.vec3(0, 0, 0),
        math.vec3(0, 0, 0),
        math.vec3(0, 0, 0),
        math.vec3(0, 0, 0),
        math.vec3(0, 0, 0),
        math.vec3(0, 0, 0),
        math.vec3(0, 0, 0),
        math.vec3(0, 0, 0),
      ],
    };
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
    p.group.add(group);

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
    // const forces = new Map<MSDParticle, math.Vector3>();

    // these function executes dozens of times per frame. It may run
    // 1000s of times per second. Any allocation avoided is a huge gain
    // to avoid trashing the heap and trigger expensive GC.

    // zero out cached forces
    for (const p of this.particles.container) {
      p.force[0] = 0;
      p.force[1] = 0;
      p.force[2] = 0;
    }

    for (const [link, [p1, p2]] of this.links) {
      // [vecX, vecY, vecZ] is link distance vector
      let [vecX, vecY, vecZ] = [
        p2.location[0] - p1.location[0],
        p2.location[1] - p1.location[1],
        p2.location[2] - p1.location[2],
      ];
      // get distance
      const distSq = vecX * vecX + vecY * vecY + vecZ * vecZ;
      const linkDist = Math.sqrt(Math.max(distSq, 1e-8));
      // [vecX, vecY, vecZ] is now link normalized direction
      vecX /= linkDist;
      vecY /= linkDist;
      vecZ /= linkDist;

      const springDisp = linkDist - link.length;

      // relative velocity dot the link direction
      const dampingDir =
        (p2.velocity[0] - p1.velocity[0]) * vecX +
        (p2.velocity[1] - p1.velocity[1]) * vecY +
        (p2.velocity[2] - p1.velocity[2]) * vecZ;

      const forceMagnitude =
        link.kSpring * springDisp + link.kDamper * dampingDir;

      // [vecX, vecY, vecZ] is now link net force
      vecX *= forceMagnitude;
      vecY *= forceMagnitude;
      vecZ *= forceMagnitude;

      // accumulate forces
      p1.force[0] += vecX;
      p1.force[1] += vecY;
      p1.force[2] += vecZ;
      p2.force[0] -= vecX;
      p2.force[1] -= vecY;
      p2.force[2] -= vecZ;
    }

    for (const p of this.particles.container) {
      if (p.tags.has("kinematic") || p.disabled) continue;

      const isFree = p.tags.has("free");

      if (isFree) {
        for (const field of this.contactFields) {
          if (field.affects(p) && field.sdf(p.location) < 0) {
            this.trespassCB(p, field);
          }
        }
        continue;
      }

      // const FNet = this.cache.temp0;

      p.force[0] += this.constAccel[0] * p.mass;
      p.force[1] += this.constAccel[1] * p.mass;
      p.force[2] += this.constAccel[2] * p.mass;

      // NOTE: if you edit this code be EXTREMELY careful of data races
      // and coupled values.

      for (const field of this.contactFields) {
        if (!field.affects(p)) continue;
        // apply contact forces

        const dist = field.sdf(p.location);
        if (dist >= 0) continue;

        // cache alias for normal
        const normal = this.cache.tempVec[0];

        field.normal(p.location, normal);
        normal.normalize();

        const normSpeed = p.velocity.dot(normal);
        const msdForceMag = -field.stiffness * dist - field.damping * normSpeed;

        // notify interested parties before the force is added so the
        // callback can record whatever it wants (impulse = force * dt is
        // computed by the caller, which knows the timestep).
        if (this.collisionCB) this.collisionCB(p, field, msdForceMag);

        p.force[0] += normal[0] * msdForceMag;
        p.force[1] += normal[1] * msdForceMag;
        p.force[2] += normal[2] * msdForceMag;

        if (field.traction && p.tags.has("tire")) {
          // cache aliases
          const forward = this.cache.tempVec[1];
          const forwardProj = this.cache.tempVec[2];
          const lateral = this.cache.tempVec[3];

          // slip angle friction

          // this is the tire forward (may not be planar to surface)
          setVector(forward, p.tireForward!);
          forward.normalize();

          // project forward onto normal (zero most of the time)
          projMut(normal, forward, forwardProj);
          forward.subtract_by(forwardProj);
          forward.normalize();

          // get lateral vector
          crossMut(normal, forward, lateral);
          lateral.normalize();

          const velFwd = p.velocity.dot(forward);
          const spdFwd = Math.abs(velFwd);
          const velLat = p.velocity.dot(lateral);

          const normalLoad = Math.max(0, msdForceMag);
          const cAlpha = field.traction.stiffness.cornering;
          const eps = 0.5; // prevents explosion at low speed
          const slipAngle = Math.atan2(velLat, spdFwd + eps);

          let forceLatMag = -cAlpha * slipAngle;
          const mu = field.traction.coeff;
          const maxForce = mu * normalLoad;
          forceLatMag = clamp(forceLatMag, -maxForce, maxForce);

          const forceLat = lateral;
          // INVALIDATED: lateral
          forceLat.scale_by(forceLatMag);

          const eInit = Math.exp(-spdFwd);
          const eEnd = Math.exp(3 * (10 - spdFwd));
          const scaling = (eEnd - eInit) / (1 + eInit) / (1 + eEnd);
          const cFwd = field.traction.stiffness.longitudinal;
          const forceFwdMag = scaling * (p.tireThrust ?? 0) - cFwd * velFwd;

          const forceFwd = forward;
          forceFwd.scale_by(forceFwdMag);
          // INVALIDATED: forward
          const forceTotal = forceFwd;
          forceTotal.add_by(forceLat);
          // INVALIDATED: forceFwd

          const mag = forceTotal.norm();
          if (mag > maxForce) {
            forceTotal.scale_by(maxForce / mag);
          }

          p.force.add_by(forceTotal);
        } else if (field.friction) {
          // // tangential friction pending. Add only if needed
          // // compute regular tangential friction forces
          // const tangVel = this.cache.tempVec[4];
          // setVector(tangVel, normal);
          // tangVel.scale_by(-normSpeed);
          // tangVel.add_by(p.velocity);
          // const tangSpeed = tangVel.norm();

          // if (tangSpeed < field.friction.threshold) {
          //   // static
          //   const fMax = Math.max(0, msdForceMag * field.friction.static);
          //   const tangForce = this.cache.tempVec[5];
          //   setVector(tangForce, p.force);
          //   tangForce.subtract_by(tangForce.dot(normal))
          //   const tangFormceMag = tangForce.dot(normal);
          //   const frictionForce = Math.min();

          //   if (tangForce.norm() <= fMax) {
          //     // zero out tangential force
          //     FNet = FNet.minus(tangForce);
          //   } else {
          //     // subtract fmax along tangent
          //     FNet = FNet.minus(tangForce.normalized().times(fMax));
          //   }
          // } else {
          //   // kinetic
          //   const normalLoad = Math.max(0, msdForceMag * field.friction.kinetic);
          //   tangVel.scale_by(1 / tangSpeed);
          //   p.force[0] -= tangVel[0] * normalLoad;
          //   p.force[1] -= tangVel[1] * normalLoad;
          //   p.force[2] -= tangVel[2] * normalLoad;
          // }
          }

        if (field.restitution && normSpeed < 0) {
          const e =
            p.contactOverrides?.restitution?.coefficient ??
            field.restitution.coefficient;
          const eScaled = normSpeed * (1 + e);
          p.velocity[0] -= normal[0] * eScaled;
          p.velocity[1] -= normal[1] * eScaled;
          p.velocity[2] -= normal[2] * eScaled;
        }
      }
    }
  }
}

export interface Integrator {
  step(system: SpringDamperSystem, dt: number): void;
}

export class SymplecticEuler implements Integrator {
  step(system: SpringDamperSystem, dt: number) {
    system.computeForces();

    for (const p of system.particles.container) {
      if (p.tags.has("kinematic") || p.tags.has("free")) continue;

      const massInv = 1 / p.mass;
      const accX = p.force[0] * massInv;
      const accY = p.force[1] * massInv;
      const accZ = p.force[2] * massInv;

      const velX = accX * dt;
      const velY = accY * dt;
      const velZ = accZ * dt;

      if (Number.isNaN(velX) || Number.isNaN(velY) || Number.isNaN(velZ)) {
        debugger;
        console.warn("NaN found in integrator");
        continue;
      }
      p.velocity[0] += velX;
      p.velocity[1] += velY;
      p.velocity[2] += velZ;

      p.location[0] += p.velocity[0] * dt;
      p.location[1] += p.velocity[1] * dt;
      p.location[2] += p.velocity[2] * dt;
    }
  }
}
