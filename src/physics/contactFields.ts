import {
  curry,
  FunctorSDF,
  sdGradient3DMut,
  sdInvertedCapsule2D,
  sdPlane,
} from "../linearAlgebra/sdfs";
import { math } from "../../tiny-graphics-math";
import { MSDParticle } from "./msdSystem";
import { PlaneChoice, Vector2 } from "../utils/math";

export type FieldRole = "ground" | "static boundary" | "dynamic boundary";

/**
 * defines the shared interface for a contact field. These are driven by
 * signed distance function which are very flexible. Penetration is
 * penalized with a spring damper system. Class that implement it only
 * define behavior do not implement it.
 */
export interface ContactField {
  affects(p: MSDParticle): boolean;
  sdf(pos: math.Vector3): number;
  normal(pos: math.Vector3, out: math.Vector3): void;
  get group(): Set<string>;

  readonly role: FieldRole;
  stiffness: number;
  damping: number;
  traction: {
    coeff: number;
    stiffness: {
      cornering: number;
      longitudinal: number;
    };
  } | null;
  friction: {
    // tangential
    static: number;
    kinetic: number;
    threshold: number;
  } | null;
  restitution: {
    coefficient: number;
  } | null;
}

type ContactProps = {
  damping: number;
  stiffness: number;
} & Partial<{
  traction: {
    coeff: number;
    stiffness: {
      cornering: number;
      longitudinal: number;
    };
  };
  friction: {
    static: number;
    kinetic: number;
    threshold: number;
  };
  restitution: {
    coefficient: number;
  };
}>;

export class PlaneField implements ContactField {
  damping: number;
  stiffness: number;
  traction: {
    coeff: number;
    stiffness: {
      cornering: number;
      longitudinal: number;
    };
  } | null;
  friction: {
    static: number;
    kinetic: number;
    threshold: number;
  } | null;
  restitution: {
    coefficient: number;
  } | null;

  private sdfFunc: FunctorSDF<math.Vector3, number>;
  private _normal: math.Vector3;
  readonly role: FieldRole;

  constructor(
    private groupSet: Set<string>,
    normal: math.Vector3,
    props: ContactProps & { height: number },
  ) {
    this.role = "ground";
    this.damping = props.damping;
    this.stiffness = props.stiffness;
    this.traction = props.traction ?? null;
    this.friction = props.friction ?? null;
    this.restitution = props.restitution ?? null;
    this._normal = normal.copy();
    this.sdfFunc = curry(sdPlane, normal, props.height);
  }

  get group(): Set<string> {
    return this.groupSet;
  }

  affects(p: MSDParticle): boolean {
    for (const allowed of this.groupSet) {
      if (p.group.has(allowed)) {
        return true;
      }
    }
    return false;
  }

  sdf(pos: math.Vector3): number {
    return this.sdfFunc(pos);
  }

  normal(pos: math.Vector3, out: math.Vector3): void {
    out[0] = this._normal[0];
    out[1] = this._normal[1];
    out[2] = this._normal[2];
  }
}

export class CartField implements ContactField {
  damping: number;
  stiffness: number;
  traction: {
    coeff: number;
    stiffness: {
      cornering: number;
      longitudinal: number;
    };
  } | null;
  friction: {
    static: number;
    kinetic: number;
    threshold: number;
  } | null;
  restitution: {
    coefficient: number;
  } | null;

  readonly role: FieldRole;
  private tempCache: math.Vector3 = math.vec3(0, 0, 0);

  constructor(
    private groupSet: Set<string>,
    private sdfFunc: FunctorSDF<math.Vector3, number>,
    props: ContactProps,
  ) {
    this.role = "dynamic boundary";
    this.damping = props.damping;
    this.stiffness = props.stiffness;
    this.traction = props.traction ?? null;
    this.friction = props.friction ?? null;
    this.restitution = props.restitution ?? null;
    this.sdfFunc = sdfFunc;
  }

  get group(): Set<string> {
    return this.groupSet;
  }

  affects(p: MSDParticle): boolean {
    for (const allowed of this.groupSet) {
      if (p.group.has(allowed)) {
        return true;
      }
    }
    return false;
  }

  sdf(pos: math.Vector3): number {
    return this.sdfFunc(pos);
  }

  normal(pos: math.Vector3, out: math.Vector3): void {
    sdGradient3DMut(pos, this.sdfFunc, 1e-3, out, this.tempCache);
  }
}

export class ArenaField implements ContactField {
  damping: number;
  stiffness: number;
  traction: {
    coeff: number;
    stiffness: {
      cornering: number;
      longitudinal: number;
    };
  } | null;
  friction: {
    static: number;
    kinetic: number;
    threshold: number;
  } | null;
  restitution: {
    coefficient: number;
  } | null;

  readonly role: FieldRole;
  private tempCache: math.Vector3 = math.vec3(0, 0, 0);
  private sdfFunc: FunctorSDF<math.Vector3, number>;

  constructor(
    private groupSet: Set<string>,
    geometry: {
      bounds: [math.Vector3, math.Vector3];
      width: number;
      onto: PlaneChoice;
    },
    props: ContactProps,
  ) {
    this.role = "static boundary";
    this.damping = props.damping;
    this.stiffness = props.stiffness;
    this.traction = props.traction ?? null;
    this.friction = props.friction ?? null;
    this.restitution = props.restitution ?? null;

    this.sdfFunc = curry(
      sdInvertedCapsule2D,
      Vector2.from3d(geometry.bounds[0], geometry.onto),
      Vector2.from3d(geometry.bounds[1], geometry.onto),
      geometry.width,
      geometry.onto,
    );
  }

  get group(): Set<string> {
    return this.groupSet;
  }

  affects(p: MSDParticle): boolean {
    for (const allowed of this.groupSet) {
      if (p.group.has(allowed)) {
        return true;
      }
    }
    return false;
  }

  sdf(pos: math.Vector3): number {
    return this.sdfFunc(pos);
  }

  normal(pos: math.Vector3, out: math.Vector3): void {
    sdGradient3DMut(pos, this.sdfFunc, 1e-3, out, this.tempCache);
  }
}
