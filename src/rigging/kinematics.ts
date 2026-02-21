import { math } from "../../tiny-graphics-math";
import { tiny } from "../../tiny-graphics";
import { clamp, matrixMult, transposeMatrix } from "../utils/math";

export type traverseCB = (
  joint: ArcJoint,
  node: NodeLink,
  matrix: math.Mat4,
) => void;

type DOFAxes = "rx" | "ry" | "rz";

type DOFRef = {
  joint: ArcJoint;
  axis: DOFAxes;
};

export class NodeLink {
  readonly name: string;
  shape: tiny.Shape;
  transform: math.Mat4;
  arcs: ArcJoint[] = [];

  constructor(name: string, shape: tiny.Shape, transform: math.Mat4) {
    this.name = name;
    this.shape = shape;
    this.transform = transform;
  }
}

export class ArcJoint {
  readonly name: string;
  parent: NodeLink | null;
  child: NodeLink;
  translation: math.Mat4;
  rotation: math.Mat4;
  effector: math.Vector3 | null;
  dofs: {
    rx: boolean;
    ry: boolean;
    rz: boolean;
  };
  angles: {
    rx: number;
    ry: number;
    rz: number;
  };
  limits: {
    rx?: [number, number];
    ry?: [number, number];
    rz?: [number, number];
  };

  constructor(
    name: string,
    parent: NodeLink | null,
    child: NodeLink,
    translation: math.Mat4,
    dofs: {
      rx?: {
        angle: number;
        limit: [number, number];
      };
      ry?: {
        angle: number;
        limit: [number, number];
      };
      rz?: {
        angle: number;
        limit: [number, number];
      };
    } = {},
  ) {
    this.name = name;
    this.parent = parent;
    this.child = child;
    this.translation = translation;
    this.rotation = math.Mat4.identity();
    this.effector = null;
    this.dofs = {
      rx: dofs.rx != undefined,
      ry: dofs.ry != undefined,
      rz: dofs.rz != undefined,
    };
    this.angles = {
      rx: dofs.rx?.angle ?? 0,
      ry: dofs.ry?.angle ?? 0,
      rz: dofs.rz?.angle ?? 0,
    };
    this.limits = {
      rx: dofs.rx?.limit ?? [0, 0],
      ry: dofs.ry?.limit ?? [0, 0],
      rz: dofs.rz?.limit ?? [0, 0],
    };
  }

  setEffector(x: number, y: number, z: number) {
    this.effector = math.vec3(x, y, z);
  }

  setAngle(axis: DOFAxes, angle: number) {
    if (this.dofs[axis]) {
      const lim = this.limits[axis] ?? [0, 0];
      this.angles[axis] = clamp(angle, lim[0], lim[1]);
      return true;
    }
    return false;
  }

  updateRotation() {
    let R = math.Mat4.identity();
    if (this.dofs.rx) {
      R.post_multiply(math.Mat4.rotation(this.angles.rx, 1, 0, 0));
    }
    if (this.dofs.ry) {
      R.post_multiply(math.Mat4.rotation(this.angles.ry, 0, 1, 0));
    }
    if (this.dofs.rz) {
      R.post_multiply(math.Mat4.rotation(this.angles.rz, 0, 0, 1));
    }
    this.rotation = R;
  }

  traverse(callback: traverseCB, matrix?: math.Mat4) {
    const dofStack: DOFRef[] = [];
    this._traverse(
      this,
      matrix ?? math.Mat4.identity(),
      callback,
      [],
      dofStack,
    );
  }

  private _traverse(
    joint: ArcJoint,
    matrix: math.Mat4,
    callback: traverseCB,
    matrixStack: math.Mat4[],
    dofStack: DOFRef[],
  ) {
    joint.updateRotation();
    const L = joint.translation;
    const A = joint.rotation;
    matrix.post_multiply(L.times(A));
    matrixStack.push(matrix.copy());

    const node = joint.child;
    const T = node.transform;
    matrix.post_multiply(T);
    callback(joint, node, matrix);

    // NOTE: asserting matrixStack is non-empty
    matrix = matrixStack.pop() as math.Mat4;
    for (const arc of node.arcs) {
      matrixStack.push(matrix.copy());
      this._traverse(arc, matrix, callback, matrixStack, dofStack);
      // NOTE: asserting matrixStack is non-empty
      matrix = matrixStack.pop() as math.Mat4;
    }
  }

  collectDOFs(out: DOFRef[]) {
    if (this.dofs.rx) {
      out.push({ joint: this, axis: "rx" });
    }
    if (this.dofs.ry) {
      out.push({ joint: this, axis: "ry" });
    }
    if (this.dofs.rz) {
      out.push({ joint: this, axis: "rz" });
    }

    for (const arc of this.child.arcs) {
      arc.collectDOFs(out);
    }
  }
}

export class IKSolver {
  sceneRoot: ArcJoint;
  // chainRoot: ArcJoint;
  effectorName: string;
  dofs: DOFRef[] = [];

  alpha = 0.1;
  eps = 1e-4;
  tolerance = 1e-3;
  maxIters = 20;

  constructor(sceneRoot: ArcJoint, chainRoot: ArcJoint, effectorName: string) {
    this.sceneRoot = sceneRoot;
    this.effectorName = effectorName;
    chainRoot.collectDOFs(this.dofs);
  }

  endEffectorPosition(): math.Vector3 {
    let result!: math.Vector3;

    this.sceneRoot.traverse((joint, node, M) => {
      if (node.name === this.effectorName) {
        let x = 0;
        let y = 0;
        let z = 0;
        if (joint.effector != null) {
          [x, y, z] = joint.effector;
        }
        const W2 = matrixMult(M, [[x], [y], [z], [1]]);
        result = math.vec3(W2[0][0], W2[1][0], W2[2][0]);
      }
    });

    return result;
  }

  computeJacobian(): number[][] {
    const J = [
      new Array(this.dofs.length),
      new Array(this.dofs.length),
      new Array(this.dofs.length),
    ];

    const P0 = this.endEffectorPosition();

    for (let i = 0; i < this.dofs.length; ++i) {
      const { joint, axis } = this.dofs[i];

      joint.angles[axis] += this.eps;
      joint.updateRotation();

      const P1 = this.endEffectorPosition();
      const dP = P1.minus(P0).times(1 / this.eps);

      J[0][i] = dP[0];
      J[1][i] = dP[1];
      J[2][i] = dP[2];

      joint.angles[axis] -= this.eps;
      joint.updateRotation();
    }

    return J;
  }

  step(goal: math.Vector3): boolean {
    const P = this.endEffectorPosition();
    const E = goal.minus(P);

    if (E.norm() < this.tolerance) return true;

    const J = this.computeJacobian();
    const JT = transposeMatrix(J);
    const dTheta = JT.map((r) =>
      E.times(this.alpha).reduce((acc, cv, i) => acc + r[i] * cv, 0),
    );

    for (let i = 0; i < this.dofs.length; i++) {
      const { joint, axis } = this.dofs[i];
      joint.angles[axis] += dTheta[i];

      const lim = joint.limits[axis];
      if (lim) {
        joint.angles[axis] = clamp(joint.angles[axis], lim[0], lim[1]);
      }

      joint.updateRotation();
    }

    return false;
  }

  solve(goal: math.Vector3) {
    for (let i = 0; i < this.maxIters; ++i) {
      if (this.step(goal)) break;
    }
  }
}
