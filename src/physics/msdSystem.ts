import { range } from "../utils/iterators";
import { math } from "../../tiny-graphics-math";
import { getOrInsertCond } from "../utils/polyfills";

type ParticleProperties = {
  mass: number;
  location: math.Vector3;
  velocity: math.Vector3;
  kinematic?: boolean;
};

type SpringProperties = {
  kSpring: number;
  kDamper: number;
  length: number;
};

type GroundPlaneProperties = {
  kSpring: number;
  kDamper: number;
};

type Triangle = [math.Vector3, math.Vector3, math.Vector3];

export interface Collection<T> {
  container: T[];
}

export class MSDParticle {
  mass: number;
  location: math.Vector3;
  velocity: math.Vector3;
  prevLocation?: math.Vector3;
  isKinematic: boolean;

  constructor(props: Partial<ParticleProperties> = {}) {
    this.mass = props.mass ?? 0;
    this.location = props.location ?? math.vec3(0, 0, 0);
    this.velocity = props.velocity ?? math.vec3(0, 0, 0);
    this.isKinematic = props.kinematic ?? false;
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

export class MSDGroundPlane {
  private _tri: Triangle;
  private _normalCache?: math.Vector3;
  kDamper: number;
  kSpring: number;

  constructor(tri: Triangle, props: Partial<GroundPlaneProperties> = {}) {
    this._tri = tri;
    this.kDamper = props.kDamper ?? 0;
    this.kSpring = props.kSpring ?? 0;
  }

  reset(props: GroundPlaneProperties) {
    this.kSpring = props.kSpring;
    this.kDamper = props.kDamper;
  }

  normal() {
    if (this._normalCache == null) {
      const [A, B, C] = this._tri;
      const P = B.minus(A);
      const Q = C.minus(A);
      this._normalCache = P.cross(Q).normalized();
      return this._normalCache;
    } else {
      return this._normalCache;
    }
  }

  projectOnto(p: math.Vector3, pType: "point" | "vector") {
    const A = this._tri[0];
    const N = this.normal();
    if (pType === "vector") {
      return p.minus(N.times(N.dot(p)));
    } else {
      return p.minus(N.times(N.dot(p.minus(A))));
    }
  }

  distance(probe: math.Vector3) {
    const A = this._tri[0];
    return this.normal().dot(probe.minus(A));
  }

  intersection(
    p1: math.Vector3,
    p2: math.Vector3,
  ): {
    location: math.Vector3;
    distance: number;
  } | null {
    // reference: https://www.desmos.com/3d/mhkxcxndij

    const A = this._tri[0];
    const gndNormal = this.normal();

    const p1Delta = p1.minus(A);
    const dist1 = gndNormal.dot(p1Delta);
    const dist2 = gndNormal.dot(p2.minus(A));

    if (Math.sign(dist1) === Math.sign(dist2)) {
      return null;
    }

    const delta = p2.minus(p1);
    // note that it would normally be A - p1 but I used the reverse and
    // factored out the negative to reuse one calculation
    const normDist = -gndNormal.dot(p1Delta);
    const normVel = gndNormal.dot(delta);
    const time = normDist / normVel;

    // NOTE: if required, calculate here the x_hat and y_hat, i.e the
    // projection of the intersection point to two edges of the triangle
    // and use those to compute the boundaries instead of checking signs
    // of the triangle. This would be more flexible.

    return {
      location: p1.plus(delta.times(time)),
      distance: Math.abs(dist2),
    };
  }

  computeForce(distance: number, velocity: math.Vector3) {
    const normal = this.normal();

    return normal.times(
      distance * this.kSpring - velocity.dot(normal) * this.kDamper,
    );
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

export interface MSDSysParams {
  coefRestitution: number;
  coefSFriction: number;
  coefKFriction: number;
  kFrictionThres: number;
}

export class SpringDamperSystem {
  springs: SpringCollection;
  particles: ParticleCollection;
  links: Map<MSDSpring, [MSDParticle, MSDParticle]>;
  groundPlane: MSDGroundPlane;
  constAccel: math.Vector3;
  params: MSDSysParams = {
    coefRestitution: 1,
    coefSFriction: 0,
    coefKFriction: 0,
    kFrictionThres: 1e-2,
  };

  constructor(
    springs: SpringCollection,
    particles: ParticleCollection,
    groundPlane: MSDGroundPlane,
    constAccel: math.Vector3,
    params: Partial<MSDSysParams> = {},
  ) {
    this.springs = springs;
    this.particles = particles;
    this.links = new Map();
    this.groundPlane = groundPlane;
    this.constAccel = constAccel;
    this.params = {
      ...this.params,
      ...params,
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

  computeForces() {
    const forces = new Map<MSDParticle, math.Vector3>();
    const velThreshold = this.params.kFrictionThres;

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
      if (p.isKinematic) continue;
      let FNet = getOrInsertCond(forces, p, () => math.vec3(0, 0, 0)).plus(
        this.constAccel.times(p.mass),
      );

      const d = this.groundPlane.distance(p.location);
      const normal = this.groundPlane.normal();
      const Nf = normal.times(normal.dot(FNet));

      if (d < 0 && p.velocity.dot(normal) < 0) {
        const FTan = FNet.minus(Nf);
        const vTan = this.groundPlane.projectOnto(p.velocity, "vector");

        if (vTan.norm() < velThreshold) {
          const muS = this.params.coefSFriction;
          const fmax = Nf.norm() * muS;

          // zero out tangential velocity under threshold
          p.velocity = p.velocity.minus(
            this.groundPlane.projectOnto(p.velocity, "vector"),
          );

          if (FTan.norm() <= fmax) {
            // zero out tangential force
            FNet = FNet.minus(FTan);
          } else {
            // subtract fmax along tangent
            FNet = FNet.minus(FTan.normalized().times(fmax));
          }
        } else {
          const muK = this.params.coefKFriction;
          FNet = FNet.minus(vTan.normalized().times(Nf.norm() * muK));
        }

        const e = this.params.coefRestitution;
        // flip velocity with applied coefficient of restitution
        const restitution = normal.times(p.velocity.dot(normal) * (1 + e));
        p.velocity = p.velocity.minus(restitution);
        FNet = FNet.plus(this.groundPlane.computeForce(-d, p.velocity));
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
      if (p.isKinematic) continue;
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
      if (p.isKinematic) continue;
      const a = forces.get(p)!.times(1 / p.mass);

      p.velocity = p.velocity.plus(a.times(dt));
      p.location = p.location.plus(p.velocity.times(dt));
    }
  }
}

export class Verlet implements Integrator {
  step(system: SpringDamperSystem, dt: number) {
    const forces = system.computeForces();

    for (const p of system.particles.container) {
      if (p.isKinematic) continue;
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
