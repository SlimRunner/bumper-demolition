import { math } from "../../tiny-graphics-math";
import { tiny } from "../../tiny-graphics";
import { createError } from "../utils/error";

const MeshError = createError("MeshError");

export function computeTangents(shape: tiny.Shape): void {
  const pos = shape.arrays.position;
  const tex = shape.arrays.texture_coord;

  // Safety check: ensure required data exists
  if (!pos || !tex) {
    throw new MeshError("Shape is missing position or texture_coord arrays");
  }

  // Initialize your custom attributes
  const tangents: math.Vector3[] = [];
  const bitangents: math.Vector3[] = [];

  // Iterate 3 vertices at a time (1 face)
  for (let i = 0; i < pos.length; i += 3) {
    const p0 = pos[i],
      p1 = pos[i + 1],
      p2 = pos[i + 2];
    const uv0 = tex[i],
      uv1 = tex[i + 1],
      uv2 = tex[i + 2];

    // Position deltas (Edges)
    const e1 = p1.minus(p0);
    const e2 = p2.minus(p0);

    // UV deltas
    // Note: uv[0] is 's' (u), uv[1] is 't' (v)
    const du1 = uv1[0] - uv0[0];
    const dv1 = uv1[1] - uv0[1];
    const du2 = uv2[0] - uv0[0];
    const dv2 = uv2[1] - uv0[1];

    // Determinant for the UV space transformation
    const den = du1 * dv2 - du2 * dv1;
    const f = den === 0 ? 0 : 1.0 / den;

    // Calculate Tangent vector
    const tangent = math
      .vec3(
        f * (dv2 * e1[0] - dv1 * e2[0]),
        f * (dv2 * e1[1] - dv1 * e2[1]),
        f * (dv2 * e1[2] - dv1 * e2[2]),
      )
      .normalized() as math.Vector3;

    // Calculate Bitangent vector
    const bitangent = math
      .vec3(
        f * (-du2 * e1[0] + du1 * e2[0]),
        f * (-du2 * e1[1] + du1 * e2[1]),
        f * (-du2 * e1[2] + du1 * e2[2]),
      )
      .normalized() as math.Vector3;

    // Push values for all 3 vertices of the current face
    for (let j = 0; j < 3; j++) {
      tangents.push(tangent);
      bitangents.push(bitangent);
    }
  }

  // Assign back to the shape.arrays object
  // Your GLSL uses 'attribute vec3 tangent, bitangent;'
  // so the keys must match exactly.
  shape.arrays.tangent = tangents;
  shape.arrays.bitangent = bitangents;
}

export function remapUVs(shape: tiny.Shape, uScale: number, vScale: number) {
  for (const uv of shape.arrays.texture_coord!) {
    uv[0] *= uScale;
    uv[1] *= vScale;
  }
}
