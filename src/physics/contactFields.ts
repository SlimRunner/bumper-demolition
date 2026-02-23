import {
  curry,
  FunctorSDF,
  sdGradient3D,
  sdPlane,
} from "../linearAlgebra/sdfs";
import { math } from "../../tiny-graphics-math";
import { MSDParticle } from "./msdSystem";

/**
 * defines the shared interface for a contact field. These are driven by
 * signed distance function which are very flexible. Penetration is
 * penalized with a spring damper system. Class that implement it only
 * define behavior do not implement it.
 */
export interface ContactField {
  affects(p: MSDParticle): boolean;
  sdf(pos: math.Vector3): number;
  normal(pos: math.Vector3): math.Vector3;

  stiffness: number;
  damping: number;
  friction?: {
    // tangential
    static: number;
    kinetic: number;
    threshold: number;
  };
  restitution?: {
    coefficient: number;
  };
}

type ContactProps = {
  height: number;
  damping: number;
  stiffness: number;
  friction?: {
    static: number;
    kinetic: number;
    threshold: number;
  };
  restitution?: {
    coefficient: number;
  };
};

export class PlaneField implements ContactField {
  damping: number;
  stiffness: number;
  friction?: {
    static: number;
    kinetic: number;
    threshold: number;
  };
  restitution?: {
    coefficient: number;
  };
  private sdfFunc: FunctorSDF<math.Vector3, number>;
  private _normal: math.Vector3;

  constructor(
    private groupSet: Set<string>,
    normal: math.Vector3,
    props: ContactProps,
  ) {
    this.damping = props.damping;
    this.stiffness = props.stiffness;
    this.friction = props.friction;
    this.restitution = props.restitution;
    this._normal = normal.normalized();
    this.sdfFunc = curry(sdPlane, normal, props.height);
  }

  affects(p: MSDParticle): boolean {
    // check if particle is within this group
    return true;
  }

  sdf(pos: math.Vector3): number {
    return this.sdfFunc(pos);
  }

  normal(pos: math.Vector3): math.Vector3 {
    return this._normal;
  }
}

export class CartField implements ContactField {
  damping: number;
  stiffness: number;
  friction?: {
    static: number;
    kinetic: number;
    threshold: number;
  };
  restitution?: {
    coefficient: number;
  };

  constructor(
    private groupSet: Set<string>,
    private sdfFunc: FunctorSDF<math.Vector3, number>,
    props: ContactProps,
  ) {
    this.damping = props.damping;
    this.stiffness = props.stiffness;
    this.friction = props.friction;
    this.restitution = props.restitution;
    this.sdfFunc = sdfFunc;
  }

  affects(p: MSDParticle): boolean {
    if (p.group) {
      return this.groupSet.has(p.group);
    }
    // false or true as default?
    return false;
  }

  sdf(pos: math.Vector3): number {
    return this.sdfFunc(pos);
  }

  normal(pos: math.Vector3): math.Vector3 {
    return sdGradient3D(pos, this.sdfFunc, 1e-3);
  }
}
