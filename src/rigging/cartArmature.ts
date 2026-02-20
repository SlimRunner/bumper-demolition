import { ArcJoint, NodeLink } from "../rigging/kinematics";
import { math } from "../../tiny-graphics-math";
import { tiny } from "../../tiny-graphics";

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

export class CartArmature {
  armature: {
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
  };

  constructor(props: {
    meshes: {
      chassis: tiny.Shape;
      wheel: tiny.Shape;
      arm1: tiny.Shape;
      arm2: tiny.Shape;
      saw: tiny.Shape;
    };
    dimensions: {
      wheelbase: number;
      axleTrack: number;
      rimSize: number;
      tireWallSize: number;
      tireWidth: number;
      roofHeight: number;
      armLinkRadius: number;
      armLinkLength: number;
      sawRadius: number;
    };
  }) {
    const {
      meshes,
      dimensions: {
        wheelbase,
        axleTrack,
        rimSize,
        tireWallSize,
        tireWidth,
        roofHeight,
        armLinkRadius,
        armLinkLength,
        sawRadius,
      },
    } = props;

    const wheelDiameter = tireWallSize + rimSize;
    const chassisLength = wheelbase + wheelDiameter * 1.5;
    const chassisWidth = axleTrack;
    const floorClearance = (wheelDiameter * 2) / 3;
    const chassisHeight = roofHeight - floorClearance;

    const chassisMatrix = math.Mat4.scale(
      chassisLength / 2,
      chassisHeight / 2,
      chassisWidth / 2,
    );
    const wheelFLMatrix = math.Mat4.scale(
      wheelDiameter / 2,
      wheelDiameter / 2,
      tireWidth,
    );
    const wheelFRMatrix = wheelFLMatrix;
    const wheelRLMatrix = wheelFLMatrix;
    const wheelRRMatrix = wheelFLMatrix;
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

    const rootMatrix = math.Mat4.translation(0, roofHeight / 2, 0);
    const wheelHubRLMatrix = math.Mat4.translation(
      -wheelbase / 2,
      -(chassisHeight - floorClearance / 2) / 2,
      -axleTrack / 2,
    );
    const wheelHubRRMatrix = math.Mat4.translation(
      -wheelbase / 2,
      -(chassisHeight - floorClearance / 2) / 2,
      axleTrack / 2,
    );
    const wheelHubFLMatrix = math.Mat4.translation(
      wheelbase / 2,
      -(chassisHeight - floorClearance / 2) / 2,
      -axleTrack / 2,
    );
    const wheelHubFRMatrix = math.Mat4.translation(
      wheelbase / 2,
      -(chassisHeight - floorClearance / 2) / 2,
      axleTrack / 2,
    );
    const sawArmJoint1Matrix = math.Mat4.translation(0, chassisHeight / 2, 0);
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
      { rz: { angle: 0, limit: [-1e100, 1e100] } },
    );
    const wheelHubFL = new ArcJoint(
      "wheelHubFL",
      chassis,
      wheelFL,
      wheelHubFLMatrix,
      { rz: { angle: 0, limit: [-1e100, 1e100] } },
    );
    const sawArmJoint1 = new ArcJoint(
      "sawArmJoint1",
      chassis,
      sawArmLink1,
      sawArmJoint1Matrix,
      { rz: { angle: -0.1, limit: [-Math.PI, 0] } },
    );
    const sawArmJoint2 = new ArcJoint(
      "sawArmJoint2",
      sawArmLink1,
      sawArmLink2,
      sawArmJoint2Matrix,
      { rz: { angle: 0.1, limit: [-Math.PI, Math.PI] } },
    );
    const sawHub = new ArcJoint("sawHub", sawArmLink2, saw, sawHubMatrix, {});

    chassis.arcs.push(
      wheelHubFL,
      wheelHubFR,
      wheelHubRL,
      wheelHubRR,
      sawArmJoint1,
    );
    sawArmLink1.arcs.push(sawArmJoint2);
    sawArmLink2.arcs.push(sawHub);

    this.armature = {
      nodes: {
        chassis,
        saw,
        sawArmLink1,
        sawArmLink2,
        wheelFL,
        wheelFR,
        wheelRL,
        wheelRR,
      },
      arcs: {
        root,
        wheelHubRL,
        wheelHubRR,
        wheelHubFR,
        wheelHubFL,
        sawArmJoint1,
        sawArmJoint2,
        sawHub,
      },
    };
  }
}
