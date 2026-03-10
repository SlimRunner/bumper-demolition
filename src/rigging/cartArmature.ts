import { ArcJoint, NodeLink } from "../rigging/kinematics";
import { math } from "../../tiny-graphics-math";
import { tiny } from "../../tiny-graphics";
import { clamp, lerp, smoothstep } from "../utils/math";
import { DrawableShape, ShapeCollection } from "src/shapes/types";

const armJointInitAngle1 = -0.1;
const armJointInitAngle2 = 0.45;

export type CartNodeNames =
  | "chassis"
  | "saw"
  | "sawArmLink1"
  | "sawArmLink2"
  | "wheelFL"
  | "wheelFR"
  | "wheelRL"
  | "wheelRR";

export type CartArcNames =
  | "root"
  | "wheelHubRL"
  | "wheelHubRR"
  | "wheelHubFR"
  | "wheelHubFL"
  | "sawArmJoint1"
  | "sawArmJoint2"
  | "sawHub";

const PI2 = 2 * Math.PI;

export class CartArmature {
  nodes: {
    chassis: NodeLink;
    wheelRL: NodeLink;
    wheelRR: NodeLink;
    wheelFR: NodeLink;
    wheelFL: NodeLink;
    sawArmLink1: NodeLink;
    sawArmLink2: NodeLink;
    saw: NodeLink;
  };
  arcs: {
    root: ArcJoint;
    wheelHubRL: ArcJoint;
    wheelHubRR: ArcJoint;
    wheelHubFR: ArcJoint;
    wheelHubFL: ArcJoint;
    sawArmJoint1: ArcJoint;
    sawArmJoint2: ArcJoint;
    sawHub: ArcJoint;
  };

  private _props = {
    armBlade: {
      timing: 0,
      animRate: 2, // units per second
      bladeAngle: 0,
      bladeAngSpeed: PI2 * 3,
      enabled: false,
      swinging: false,
    },
    control: {
      steer: {
        maxAngle: (Math.PI * 40) / 180,
        animRate: 4, // units per second ??
        direction: 0,
        angle: 0,
      },
      thrust: {
        target: 0,
        force: 0,
      },
    },
    spinRR: 0,
    spinRL: 0,
    spinFR: 0,
    spinFL: 0,
  };
  private _tireRadius: number;

  constructor(props: {
    meshes: {
      chassis: tiny.Shape | DrawableShape | ShapeCollection;
      wheel: tiny.Shape | DrawableShape | ShapeCollection;
      arm1: tiny.Shape | DrawableShape | ShapeCollection;
      arm2: tiny.Shape | DrawableShape | ShapeCollection;
      saw: tiny.Shape | DrawableShape | ShapeCollection;
    };
    dimensions: {
      chassisWidth: number;
      chassisLength: number;
      chassisHeight: number;
      wheelbase: number;
      axleTrack: number;
      rimSize: number;
      tireWallSize: number;
      tireWidth: number;
      floorClearance: number;
      armLinkRadius: number;
      armLinkLength: number;
      sawRadius: number;
    };
  }) {
    const {
      meshes,
      dimensions: {
        chassisWidth,
        chassisLength,
        chassisHeight,
        wheelbase,
        axleTrack,
        rimSize,
        tireWallSize,
        tireWidth,
        floorClearance,
        armLinkRadius,
        armLinkLength,
        sawRadius,
      },
    } = props;

    const sawJointOffset = -chassisLength * 0.05;
    const wheelDiameter = tireWallSize + rimSize;
    this._tireRadius = wheelDiameter / 2;
    const wheelToGroundDist =
      floorClearance + (chassisHeight - wheelDiameter) / 2;

    const chassisMatrix = math.Mat4.scale(
      chassisLength / 2,
      chassisHeight / 2,
      chassisWidth / 2,
    );
    const wheelFLMatrix = math.Mat4.scale(
      wheelDiameter / 2,
      wheelDiameter / 2,
      -tireWidth,
    );
    const wheelFRMatrix = math.Mat4.scale(
      wheelDiameter / 2,
      wheelDiameter / 2,
      tireWidth,
    );
    const wheelRLMatrix = wheelFLMatrix;
    const wheelRRMatrix = wheelFRMatrix;
    const sawArmLink1Matrix = math.Mat4.translation(-armLinkLength / 2, 0, 0)
      .times(math.Mat4.rotation(Math.PI / 2, 0, 1, 0))
      .times(math.Mat4.scale(armLinkRadius, armLinkRadius, armLinkLength));
    const sawArmLink2Matrix = math.Mat4.translation(armLinkLength / 2, 0, 0)
      .times(math.Mat4.rotation(Math.PI / 2, 0, 1, 0))
      .times(math.Mat4.scale(armLinkRadius, armLinkRadius, armLinkLength));
    const sawMatrix = math.Mat4.scale(sawRadius, sawRadius, sawRadius);

    const chassis = new NodeLink("chassis", meshes.chassis, chassisMatrix);
    const saw = new NodeLink("saw", meshes.saw, sawMatrix);
    const sawArmLink1 = new NodeLink(
      "sawArmLink1",
      meshes.arm1,
      sawArmLink1Matrix,
    );
    const sawArmLink2 = new NodeLink(
      "sawArmLink2",
      meshes.arm2,
      sawArmLink2Matrix,
    );
    const wheelFL = new NodeLink("wheelFL", meshes.wheel, wheelFLMatrix);
    const wheelFR = new NodeLink("wheelFR", meshes.wheel, wheelFRMatrix);
    const wheelRL = new NodeLink("wheelRL", meshes.wheel, wheelRLMatrix);
    const wheelRR = new NodeLink("wheelRR", meshes.wheel, wheelRRMatrix);

    const rootMatrix = math.Mat4.translation(
      0,
      floorClearance + chassisHeight / 2,
      0,
    );
    const wheelHubRLMatrix = math.Mat4.translation(
      -wheelbase / 2,
      -wheelToGroundDist,
      -axleTrack / 2,
    );
    const wheelHubRRMatrix = math.Mat4.translation(
      -wheelbase / 2,
      -wheelToGroundDist,
      axleTrack / 2,
    );
    const wheelHubFLMatrix = math.Mat4.translation(
      wheelbase / 2,
      -wheelToGroundDist,
      -axleTrack / 2,
    );
    const wheelHubFRMatrix = math.Mat4.translation(
      wheelbase / 2,
      -wheelToGroundDist,
      axleTrack / 2,
    );
    const sawArmJoint1Matrix = math.Mat4.translation(
      sawJointOffset,
      chassisHeight / 2,
      0,
    );
    const sawArmJoint2Matrix = math.Mat4.translation(-armLinkLength, 0, 0);
    const sawHubMatrix = math.Mat4.translation(armLinkLength, 0, 0);

    const root = new ArcJoint("root", null, chassis, rootMatrix, {});
    const wheelHubRL = new ArcJoint(
      "wheelHubRL",
      chassis,
      wheelRL,
      wheelHubRLMatrix,
      { rz: { angle: 0, limit: [-1e100, 1e100] } },
    );
    const wheelHubRR = new ArcJoint(
      "wheelHubRR",
      chassis,
      wheelRR,
      wheelHubRRMatrix,
      { rz: { angle: 0, limit: [-1e100, 1e100] } },
    );
    const wheelHubFR = new ArcJoint(
      "wheelHubFR",
      chassis,
      wheelFR,
      wheelHubFRMatrix,
      {
        rz: { angle: 0, limit: [-1e100, 1e100] },
        ry: { angle: 0, limit: [(-45 / 180) * Math.PI, (45 / 180) * Math.PI] },
      },
    );
    const wheelHubFL = new ArcJoint(
      "wheelHubFL",
      chassis,
      wheelFL,
      wheelHubFLMatrix,
      {
        rz: { angle: 0, limit: [-1e100, 1e100] },
        ry: { angle: 0, limit: [(-45 / 180) * Math.PI, (45 / 180) * Math.PI] },
      },
    );
    const sawArmJoint1 = new ArcJoint(
      "sawArmJoint1",
      chassis,
      sawArmLink1,
      sawArmJoint1Matrix,
      { rz: { angle: armJointInitAngle1, limit: [-Math.PI, 0] } },
    );
    const sawArmJoint2 = new ArcJoint(
      "sawArmJoint2",
      sawArmLink1,
      sawArmLink2,
      sawArmJoint2Matrix,
      { rz: { angle: armJointInitAngle2, limit: [-Math.PI, Math.PI] } },
    );
    const sawHub = new ArcJoint("sawHub", sawArmLink2, saw, sawHubMatrix, {
      rz: { angle: 0, limit: [-1e100, 1e100] },
    });

    chassis.arcs.push(
      wheelHubFL,
      wheelHubFR,
      wheelHubRL,
      wheelHubRR,
      sawArmJoint1,
    );
    sawArmLink1.arcs.push(sawArmJoint2);
    sawArmLink2.arcs.push(sawHub);

    this.nodes = {
      chassis,
      saw,
      sawArmLink1,
      sawArmLink2,
      wheelFL,
      wheelFR,
      wheelRL,
      wheelRR,
    };
    this.arcs = {
      root,
      wheelHubRL,
      wheelHubRR,
      wheelHubFR,
      wheelHubFL,
      sawArmJoint1,
      sawArmJoint2,
      sawHub,
    };
  }

  resetState() {
    this._props = {
      armBlade: {
        timing: 0,
        animRate: 2,
        bladeAngle: 0,
        bladeAngSpeed: PI2 * 3,
        enabled: false,
        swinging: false,
      },
      control: {
        steer: {
          maxAngle: (Math.PI * 40) / 180,
          animRate: 4, // units per second
          direction: 0,
          angle: 0,
        },
        thrust: {
          target: 0,
          force: 0,
        },
      },
      spinRR: 0,
      spinRL: 0,
      spinFR: 0,
      spinFL: 0,
    };
    this.arcs.sawArmJoint1.setAngle("rz", armJointInitAngle1);
    this.arcs.sawArmJoint2.setAngle("rz", armJointInitAngle2);
    this.arcs.sawHub.setAngle("rz", 0);
    this.arcs.wheelHubFL.setAngle("rz", 0);
    this.arcs.wheelHubFR.setAngle("rz", 0);
    this.arcs.wheelHubRL.setAngle("rz", 0);
    this.arcs.wheelHubRR.setAngle("rz", 0);
    this.arcs.wheelHubFL.setAngle("ry", 0);
    this.arcs.wheelHubFR.setAngle("ry", 0);
  }

  updateTires(
    velocity: {
      rearLeft: number;
      rearRight: number;
      frontLeft: number;
      frontRight: number;
    },
    time: number,
  ) {
    // negated so that < 0 means car is backing up
    this._props.spinFL -= (velocity.frontLeft / this._tireRadius) * time;
    this._props.spinFR -= (velocity.frontRight / this._tireRadius) * time;
    this._props.spinRL -= (velocity.rearLeft / this._tireRadius) * time;
    this._props.spinRR -= (velocity.rearRight / this._tireRadius) * time;

    this.arcs.wheelHubFL.setAngle("rz", this._props.spinFL % PI2);
    this.arcs.wheelHubFR.setAngle("rz", this._props.spinFR % PI2);
    this.arcs.wheelHubRL.setAngle("rz", this._props.spinRL % PI2);
    this.arcs.wheelHubRR.setAngle("rz", this._props.spinRR % PI2);
  }

  setBladeStatus(enable: boolean) {
    this._props.armBlade.enabled = enable;
  }

  swingArm() {
    const anim = this._props.armBlade;
    if (anim.enabled && !anim.swinging) {
      anim.timing = 0;
      anim.swinging = true;
    }
  }

  updateArm(timeDelta: number) {
    const anim = this._props.armBlade;
    if (anim.swinging) {
      anim.timing = anim.timing + timeDelta * anim.animRate;
      // reference: https://www.desmos.com/calculator/jaagh3jawk
      let t = smoothstep(
        clamp(anim.timing, 0, 1) + clamp(9 - anim.timing, 4, 5) - 5,
      );

      this.arcs.sawArmJoint1.setAngle(
        "rz",
        lerp(armJointInitAngle1, -Math.PI * 0.9, t),
      );
      this.arcs.sawArmJoint2.setAngle(
        "rz",
        lerp(armJointInitAngle2, Math.PI * 0.6, t),
      );
      if (anim.timing > 5) {
        anim.swinging = false;
      }
    }
    if (anim.enabled) {
      anim.bladeAngle =
        (anim.bladeAngle + anim.bladeAngSpeed * timeDelta) % PI2;
      this.arcs.sawHub.setAngle("rz", -anim.bladeAngle);
    }
  }

  updateControls(timeDelta: number) {
    const {
      control: { steer, thrust },
    } = this._props;

    if (steer.angle < steer.direction) {
      steer.angle = Math.min(
        steer.direction,
        steer.angle + steer.animRate * timeDelta,
      );
    } else {
      steer.angle = Math.max(
        steer.direction,
        steer.angle - steer.animRate * timeDelta,
      );
    }
    // add animation if need smooth thrust
    thrust.force = thrust.target;
  }

  get steerAngle() {
    return this._props.control.steer.angle * this._props.control.steer.maxAngle;
  }

  get thrustForce() {
    return this._props.control.thrust.force;
  }

  set steerTarget(unit: number) {
    this._props.control.steer.direction = unit;
  }

  set thrustForce(thrust: number) {
    this._props.control.thrust.target = thrust;
  }

  updateFrontWheels(angleLeft: number, angleRight: number) {
    // negated so that < 0 means left and vice-versa
    this.arcs.wheelHubFL.setAngle("ry", -angleLeft);
    this.arcs.wheelHubFR.setAngle("ry", -angleRight);
  }
}
