import { tiny, Uniforms, MaterialRecord } from "../../tiny-graphics";
import { math } from "../../tiny-graphics-math";
import { createError } from "../utils/error";
import { normalizeLines } from "../utils/text";
import { affineTransform, VectorKind } from "../utils/math";

export const OBJParserError = createError("OBJParserError");

export class FileMesh extends tiny.Shape {
  private _ready = false;
  private _transform?: math.Mat4;

  constructor(filename: string, preTransform?: math.Mat4) {
    super("position", "normal", "texture_coord");

    this._transform = preTransform;
    this.loadFile(filename);
  }

  private loadFile(filename: string) {
    return fetch(filename)
      .then((res) => {
        if (res.ok) return Promise.resolve(res.text());
        else return Promise.reject(res.status);
      })
      .then((objFile) => {
        this.loadData(objFile);
      })
      .catch((err) => {
        throw "OBJ error: file not found or format is unsupported.";
      });
  }

  private loadData(objFile: string) {
    let lineNumber = 0;
    let errors = 0;
    const expressions = normalizeLines(objFile);
    const lines = expressions.split("\n");
    const at = <T>(arr: Array<T>, i: number) => {
      i = i > 0 ? i - 1 : arr.length + i;
      if (i < 0 || i >= arr.length) {
        throw new OBJParserError(
          "Face contains reference to undefined element",
        );
      }
      return arr[i];
    };

    const vertices: math.Vector3[] = [];
    const vertNormals: math.Vector3[] = [];
    const textures: math.Vector<2>[] = [];
    const faces: _3tuple<FaceIndexPack>[] = [];

    // parsing step: in this loop all the original values are
    // accumulated. TypeScript ensures that you can trust every single
    // value you find in the switch-case. If you need to implement more
    // types of OBJ lines simply edit the switch case and add the
    // appropriate token dispatcher below in `parseOBJLine`
    for (const line of lines) {
      ++lineNumber;
      try {
        const expr: exprPayload = parseOBJLine(line);

        switch (expr.ident) {
          case "mtllib":
            throw new OBJParserError(`'${expr.ident}' not implemented`);
          case "v":
            if (this._transform) {
              const v = affineTransform(
                this._transform,
                expr.params.coords,
                VectorKind.point,
              );
              vertices.push(math.vec3(...v));
            } else {
              vertices.push(math.vec3(...expr.params.coords));
            }
            break;
          case "f":
            faces.push(expr.params.indices);
            break;
          case "vt":
            textures.push(math.Vector.create(...expr.params.coords));
            break;
          case "vn":
            if (this._transform) {
              const n = affineTransform(
                this._transform,
                expr.params.coords,
                VectorKind.vector,
              );
              vertNormals.push(math.vec3(...n));
            } else {
              vertNormals.push(math.vec3(...expr.params.coords));
            }
            break;
          case "usemtl":
            throw new OBJParserError(`'${expr.ident}' not implemented`);
          case "s":
            throw new OBJParserError(`'${expr.ident}' not implemented`);
          case "o":
            throw new OBJParserError(`'${expr.ident}' not implemented`);
          case "g":
            throw new OBJParserError(`'${expr.ident}' not implemented`);
          default: // just in case this code is modified in JS
            throw new Error("Parser type safety violated");
        }
      } catch (error: unknown) {
        if (error instanceof OBJParserError) {
          ++errors;
          console.error(`${error.name}: line ${lineNumber}: ${error.message}`);
          continue;
        } else {
          throw error;
        }
      }
    }

    // here is where all the data is pushed into the tiny-graphics Shape
    for (const tri of faces) {
      for (const idx of tri) {
        this.arrays.position!.push(at(vertices, idx.vertex));
        if (idx.ident === "V-T" || idx.ident === "V-T-N") {
          this.arrays.texture_coord!.push(at(textures, idx.texture));
        }
        if (idx.ident === "V-N" || idx.ident === "V-T-N") {
          this.arrays.normal!.push(at(vertNormals, idx.normal));
        }
      }
    }
    this._ready = true;
  }

  draw(
    webgl_manager: tiny.Component,
    uniforms: Uniforms,
    model_transform: math.Mat4,
    material: MaterialRecord,
    type?: keyof WebGL2RenderingContext,
  ): void {
    if (this._ready) {
      super.draw(webgl_manager, uniforms, model_transform, material, type);
    }
  }
}

class TokenStream {
  private i = 0;

  constructor(private tokens: string[]) {}

  next(): string {
    if (this.i >= this.tokens.length) {
      throw new OBJParserError("unexpected end of input");
    }
    return this.tokens[this.i++];
  }

  nextOpt(): string | null {
    if (this.i >= this.tokens.length) {
      return null;
    }
    return this.tokens[this.i++];
  }

  get remaining() {
    return this.tokens.length - this.i;
  }
}

type _2tuple = [number, number];
type _3tuple<T> = [T, T, T];

type MTLExpr = {
  ident: "mtllib";
  params: {
    filename: string;
  };
};

type VertexExpr = {
  ident: "v";
  params: {
    coords: _3tuple<number>;
  };
};

type FacePack_V = {
  ident: "V";
  vertex: number;
};

type FacePack_VT = {
  ident: "V-T";
  vertex: number;
  texture: number;
};

type FacePack_VTN = {
  ident: "V-T-N";
  vertex: number;
  texture: number;
  normal: number;
};

type FacePack_VN = {
  ident: "V-N";
  vertex: number;
  normal: number;
};

type FaceIndexPack = FacePack_V | FacePack_VT | FacePack_VTN | FacePack_VN;

type FaceExpr = {
  ident: "f";
  params: {
    indices: _3tuple<FaceIndexPack>;
  };
};

type VTexExpr = {
  ident: "vt";
  params: {
    coords: _2tuple;
  };
};

type VNormExpr = {
  ident: "vn";
  params: {
    coords: _3tuple<number>;
  };
};

type UseMtlExpr = {
  ident: "usemtl";
  params: {
    name: string | null;
  };
};

type smoothingExpr = {
  ident: "s";
  params: {
    group: unknown;
  };
};

type objectExpr = {
  ident: "o";
  params: {
    name: string;
  };
};

type groupExpr = {
  ident: "g";
  params: {
    name: string;
  };
};

export type exprPayload =
  | MTLExpr
  | VertexExpr
  | FaceExpr
  | VTexExpr
  | VNormExpr
  | UseMtlExpr
  | smoothingExpr
  | objectExpr
  | groupExpr;

type Idents = exprPayload["ident"];

function isNumeric(text: string) {
  const num = Number(text);
  return Number.isNaN(num) ? null : num;
}

function assertToken(valid: boolean, msg: string): asserts valid {
  if (!valid) {
    throw new OBJParserError(msg);
  }
}

function parseOBJLine(expression: string): exprPayload {
  const words = expression.trim().replace(/ +/g, " ").split(" ");
  const tokens = new TokenStream(words);

  const head = tokens.nextOpt() as Idents;
  assertToken(head != null, "expression is empty");

  switch (head) {
    case "mtllib":
      assertToken(false, `Implementation pending: '${head}'`);
    case "v":
      return tokenVertex(tokens);
    case "f":
      return tokenFace(tokens);
    case "vt":
      return tokenVtTexture(tokens);
    case "vn":
      return tokenVNormal(tokens);
    case "usemtl":
      assertToken(false, `Implementation pending: '${head}'`);
    case "s":
      assertToken(false, `Implementation pending: '${head}'`);
    case "o":
      assertToken(false, `Implementation pending: '${head}'`);
    case "g":
      assertToken(false, `Implementation pending: '${head}'`);
    default:
      assertToken(false, `Unrecognized function found: '${head}'`);
  }
}

function tokenVertex(tokens: TokenStream): VertexExpr {
  assertToken(
    tokens.remaining === 3,
    `'v' expects 3 parameters, ${tokens.remaining} found`,
  );

  const x = isNumeric(tokens.next());
  assertToken(x != null, "x-coord in vertex not numeric");
  const y = isNumeric(tokens.next());
  assertToken(y != null, "y-coord in vertex not numeric");
  const z = isNumeric(tokens.next());
  assertToken(z != null, "z-coord in vertex not numeric");

  return {
    ident: "v",
    params: {
      coords: [x, y, z],
    },
  };
}

function tokenVNormal(tokens: TokenStream): VNormExpr {
  assertToken(
    tokens.remaining === 3,
    `'vn' expects 3 parameters, ${tokens.remaining} found`,
  );

  const x = isNumeric(tokens.next());
  assertToken(x != null, "x-coord in normal not numeric");
  const y = isNumeric(tokens.next());
  assertToken(y != null, "y-coord in normal not numeric");
  const z = isNumeric(tokens.next());
  assertToken(z != null, "z-coord in normal not numeric");

  return {
    ident: "vn",
    params: {
      coords: [x, y, z],
    },
  };
}

function tokenVtTexture(tokens: TokenStream): VTexExpr {
  assertToken(
    tokens.remaining === 2,
    `'vt' expects 2 parameters, ${tokens.remaining} found`,
  );

  const u = isNumeric(tokens.next());
  assertToken(u != null, "u-coord in texture is not numeric");
  const v = isNumeric(tokens.next());
  assertToken(v != null, "v-coord in texture is not numeric");

  return {
    ident: "vt",
    params: {
      coords: [u, v],
    },
  };
}

function tokenFace(tokens: TokenStream): FaceExpr {
  assertToken(
    tokens.remaining === 3,
    `this parser only supports triangles, ${tokens.remaining} tokens were found.`,
  );

  const params: FaceIndexPack[] = [];

  for (let i = 0; i < 3; ++i) {
    const vInfo = new TokenStream(tokens.next().split("/"));

    switch (vInfo.remaining) {
      case 1:
        {
          const vertex = isNumeric(vInfo.next());
          assertToken(
            vertex != null && vertex !== 0 && Number.isInteger(vertex),
            "vertex index must be a non-zero integer",
          );
          params.push({ ident: "V", vertex });
        }
        break;
      case 2:
        {
          const vertex = isNumeric(vInfo.next());
          assertToken(
            vertex != null && vertex !== 0 && Number.isInteger(vertex),
            "vertex index must be a non-zero integer",
          );
          const texture = isNumeric(vInfo.next());
          assertToken(
            texture != null && texture !== 0 && Number.isInteger(texture),
            "texture index must be a non-zero integer",
          );
          params.push({ ident: "V-T", vertex, texture });
        }
        break;
      case 3:
        {
          const vertex = isNumeric(vInfo.next());
          assertToken(
            vertex != null && vertex !== 0 && Number.isInteger(vertex),
            "vertex index must be a non-zero integer",
          );
          // empty one must be consumed anyway
          const textureOpt = vInfo.next();
          const normal = isNumeric(vInfo.next());
          assertToken(
            normal != null && normal !== 0 && Number.isInteger(normal),
            "normal index must be a non-zero integer",
          );
          if (textureOpt === "") {
            params.push({ ident: "V-N", vertex, normal });
          } else {
            const texture = isNumeric(textureOpt);
            assertToken(
              texture != null && texture !== 0 && Number.isInteger(texture),
              "texture index must be a non-zero integer",
            );
            params.push({ ident: "V-T-N", vertex, texture, normal });
          }
        }
        break;
      default:
        assertToken(
          false,
          `incorrect face element syntax found: ${vInfo.remaining} > 3`,
        );
    }
  }

  return {
    ident: "f",
    params: {
      indices: [params[0], params[1], params[2]],
    },
  };
}
