import { tiny, Uniforms, MaterialRecord } from "../../tiny-graphics";
import { math } from "../../tiny-graphics-math";
import { defs } from "../../examples/common";
import { createError } from "../utils/error";
import { normalizeLines, resolveSiblingPath } from "../utils/text";
import { affineTransform, VectorKind } from "../utils/math";
import { loadFile } from "../utils/requests";
import { DrawableShape, ShapeCollection } from "./types";
import { computeTangents } from "./extendMesh";

export const OBJParserError = createError("OBJParserError");
export const OBJImplMissing = createError("OBJImplMissing");
export const MTLParserError = createError("MTLParserError");
export const MTLImplMissing = createError("MTLParserError");

interface MTLMaterial {
  name: string;
  Ns?: number; // specular exponent (0-1000)
  Ka?: [number, number, number]; // ambient color
  Kd?: [number, number, number]; // diffuse color
  Ks?: [number, number, number]; // specular color
  Ke?: [number, number, number]; // emissive color
  Ni?: number; // optical density
  d?: number; // dissolve/opacity (0-1)
  illum?: number; // illumination model
}

export class FileMesh implements ShapeCollection {
  private _ready = false;
  private _transform?: math.Mat4;
  private _uvscale?: math.Vector<2>;
  private _materials: Map<string, MaterialRecord> = new Map();
  // each key is a material name from usemtl; the shape holds that group's geometry
  private _geometries: Map<string, tiny.Shape> = new Map();

  constructor(
    filename: string,
    preTransform?: math.Mat4,
    uvScaling?: math.Vector<2>,
  ) {
    this._transform = preTransform;
    this._uvscale = uvScaling;
    loadFile(filename)
      .then((file) => {
        this.loadOBJ(file, filename);
      })
      .catch((err) => {
        throw err;
      });
  }

  private parseMTL(mtlFile: string, path: string): void {
    let lineNumber = 0;
    let errors = 0;
    const lines = normalizeLines(mtlFile).split("\n");
    let currentMaterial: MTLMaterial | null = null;

    for (const line of lines) {
      ++lineNumber;
      if (line.trim() === "") continue;

      try {
        const expr: MTLPayload = parseMTLLine(line);

        switch (expr.ident) {
          case "newmtl":
            if (currentMaterial) {
              this.addMaterial(currentMaterial);
            }
            currentMaterial = { name: expr.params.name };
            break;
          case "Ns":
            if (currentMaterial) {
              currentMaterial.Ns = expr.params.specularWeight;
            }
            break;
          case "Ka":
            if (currentMaterial) {
              currentMaterial.Ka = expr.params.ambientColor;
            }
            break;
          case "Kd":
            if (currentMaterial) {
              currentMaterial.Kd = expr.params.diffuseColor;
            }
            break;
          case "Ks":
            if (currentMaterial) {
              currentMaterial.Ks = expr.params.specularColor;
            }
            break;
          case "Ke":
            if (currentMaterial) {
              currentMaterial.Ke = expr.params.emissiveColor;
            }
            break;
          case "Ni":
            if (currentMaterial) {
              currentMaterial.Ni = expr.params.indexOfRefraction;
            }
            break;
          case "d":
            if (currentMaterial) {
              currentMaterial.d = expr.params.alpha;
            }
            break;
          case "Tr":
            if (currentMaterial) {
              currentMaterial.d = 1 - expr.params.transparency;
            }
            break;
          case "illum":
            if (currentMaterial) {
              currentMaterial.illum = expr.params.model;
            }
            break;
          case "#":
            // ignore comments
            break;
          default: // just in case this code is modified in JS
            throw new Error("Parser type safety violated");
        }
      } catch (error) {
        if (error instanceof MTLParserError) {
          ++errors;
          console.error(
            `${error.name}: ${path}: line ${lineNumber}: ${error.message}`,
          );
          continue;
        } else if (error instanceof MTLImplMissing) {
          console.info(
            `${error.name}: ${path}: line ${lineNumber}: ${error.message}`,
          );
          continue;
        } else {
          throw error;
        }
      }
    }

    // Add the last material
    if (currentMaterial) {
      this.addMaterial(currentMaterial);
    }

    // Log all loaded materials
    console.log(`[MTL] Total materials loaded: ${this._materials.size}`);
    this._materials.forEach((material, name) => {
      console.log(`  - ${name}:`, material);
    });
  }

  private addMaterial(mtlMat: MTLMaterial): void {
    // Convert MTL material to tiny-graphics Phong material.
    // Kd is a diffuse COLOR (rgb), not a scalar — do not average it for diffusivity.
    // Ks is a specular COLOR (rgb) — average it to get a specularity scalar.
    const material: MaterialRecord = {
      shader: new defs.Phong_Shader(5),
      // Kd is the diffuse color; use it directly as the surface color
      color: mtlMat.Kd
        ? math.color(mtlMat.Kd[0], mtlMat.Kd[1], mtlMat.Kd[2], mtlMat.d ?? 1.0)
        : math.color(0.8, 0.8, 0.8, 1.0),
      // Full diffuse response to lights so color is visible
      diffusivity: 1.0,
      // Ka average controls how much ambient light this surface picks up
      ambient: mtlMat.Ka
        ? (mtlMat.Ka[0] + mtlMat.Ka[1] + mtlMat.Ka[2]) / 3
        : 0.2,
      // Ks average is the specular reflectance intensity
      specularity: mtlMat.Ks
        ? (mtlMat.Ks[0] + mtlMat.Ks[1] + mtlMat.Ks[2]) / 3
        : 0.3,
    };

    this._materials.set(mtlMat.name, material);
    console.log(`[MTL] Loaded material: ${mtlMat.name}`);
  }

  public getMaterial(name: string): MaterialRecord | undefined {
    return this._materials.get(name);
  }

  public getAllMaterials(): Map<string, MaterialRecord> {
    return this._materials;
  }

  private loadOBJ(objFile: string, path: string) {
    let lineNumber = 0;
    let errors = 0;
    const lines = normalizeLines(objFile).split("\n");
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
    // faces grouped by their active usemtl name; "__default__" when none
    const faceGroups: Map<string, _3tuple<FaceIndexPack>[]> = new Map();
    let currentMaterialName = "__default__";
    faceGroups.set(currentMaterialName, []);

    // parsing step: in this loop all the original values are
    // accumulated. TypeScript ensures that you can trust every single
    // value you find in the switch-case. If you need to implement more
    // types of OBJ lines simply edit the switch case and add the
    // appropriate token dispatcher below in `parseOBJLine`
    for (const line of lines) {
      ++lineNumber;
      if (line.trim() === "") continue;

      try {
        const expr: OBJPayload = parseOBJLine(line);

        switch (expr.ident) {
          case "mtllib":
            {
              const mtlPath = resolveSiblingPath(path, expr.params.filename);
              loadFile(mtlPath)
                .then((mtlFile) => {
                  this.parseMTL(mtlFile, mtlPath);
                })
                .catch((err) => {
                  throw err;
                });
            }
            break;
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
            faceGroups.get(currentMaterialName)!.push(expr.params.indices);
            break;
          case "vt":
            if (this._uvscale) {
              let [u, v] = expr.params.coords;
              u *= this._uvscale[0];
              v *= this._uvscale[1];
              textures.push(math.Vector.create(u, v));
            } else {
              textures.push(math.Vector.create(...expr.params.coords));
            }
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
            currentMaterialName = expr.params.name ?? "__default__";
            if (!faceGroups.has(currentMaterialName)) {
              faceGroups.set(currentMaterialName, []);
            }
            break;
          case "s":
            throw new OBJImplMissing(`'${expr.ident}' not implemented`);
          case "o":
            throw new OBJImplMissing(`'${expr.ident}' not implemented`);
          case "g":
            throw new OBJImplMissing(`'${expr.ident}' not implemented`);
          case "#":
            // ignore comments
            break;
          default: // just in case this code is modified in JS
            throw new Error("Parser type safety violated");
        }
      } catch (error: unknown) {
        if (error instanceof OBJParserError) {
          ++errors;
          console.error(
            `${error.name}: ${path}: line ${lineNumber}: ${error.message}`,
          );
          continue;
        } else if (error instanceof OBJImplMissing) {
          console.info(
            `${error.name}: ${path}: line ${lineNumber}: ${error.message}`,
          );
          continue;
        } else {
          throw error;
        }
      }
    }

    // Build one sub-shape per material group and populate this.arrays with everything
    for (const [matName, groupFaces] of faceGroups) {
      if (groupFaces.length === 0) continue;

      const subShape = new tiny.Shape(
        "position",
        "normal",
        "texture_coord",
        "tangents",
        "bitangents",
      );
      subShape.arrays.position = [];
      subShape.arrays.normal = [];
      subShape.arrays.texture_coord = [];

      for (const tri of groupFaces) {
        for (const idx of tri) {
          subShape.arrays.position.push(at(vertices, idx.vertex));
          if (idx.ident === "V-T" || idx.ident === "V-T-N") {
            subShape.arrays.texture_coord.push(at(textures, idx.texture));
          }
          if (idx.ident === "V-N" || idx.ident === "V-T-N") {
            subShape.arrays.normal.push(at(vertNormals, idx.normal));
          }
        }
      }

      // compute tangets and bitangents for easy bump mapping
      computeTangents(subShape);

      this._geometries.set(matName, subShape);
    }
    this._ready = true;
  }

  foreach(
    backFn: (
      shape: DrawableShape,
      material: MaterialRecord | undefined,
      name: string,
    ) => void,
  ): void {
    for (const [matKey, shape] of this._geometries) {
      const material = this._materials.get(matKey);
      if (this._ready) {
        backFn(shape, material, matKey);
      }
    }
  }

  draw(
    webgl_manager: tiny.Component,
    uniforms: Uniforms,
    model_transform: math.Mat4,
    material: MaterialRecord,
    type?: keyof WebGL2RenderingContext,
  ): void {
    this.foreach((shape, subMat, name) => {
      shape.draw(
        webgl_manager,
        uniforms,
        model_transform,
        {
          ...subMat,
          ...material,
        },
        type,
      );
    });
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

type CommentExpr = {
  ident: "#";
  params: {
    message: string;
  };
};

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

export type OBJPayload =
  | CommentExpr
  | MTLExpr
  | VertexExpr
  | FaceExpr
  | VTexExpr
  | VNormExpr
  | UseMtlExpr
  | smoothingExpr
  | objectExpr
  | groupExpr;

type OBJIdents = OBJPayload["ident"];

type NewMTLExpr = {
  ident: "newmtl";
  params: {
    name: string;
  };
};

type NsExpr = {
  ident: "Ns";
  params: {
    specularWeight: number;
  };
};

type KaExpr = {
  ident: "Ka";
  params: {
    ambientColor: _3tuple<number>;
  };
};

type KdExpr = {
  ident: "Kd";
  params: {
    diffuseColor: _3tuple<number>;
  };
};

type KsExpr = {
  ident: "Ks";
  params: {
    specularColor: _3tuple<number>;
  };
};

type KeExpr = {
  ident: "Ke";
  params: {
    emissiveColor: _3tuple<number>;
  };
};

type NiExpr = {
  ident: "Ni";
  params: {
    indexOfRefraction: number;
  };
};

type dExpr = {
  ident: "d";
  params: {
    alpha: number;
  };
};

type TrExpr = {
  ident: "Tr";
  params: {
    transparency: number;
  };
};

enum IllumModels {
  // Color on and Ambient off
  ILLUM00 = 0,
  // Color on and Ambient on
  ILLUM01 = 1,
  // Highlight on
  ILLUM02 = 2,
  // Reflection on and Ray trace on
  ILLUM03 = 3,
  // Transparency: Glass on Reflection: Ray trace on
  ILLUM04 = 4,
  // Reflection: Fresnel on and Ray trace on
  ILLUM05 = 5,
  // Transparency: Refraction on Reflection: Fresnel off and Ray trace on
  ILLUM06 = 6,
  // Transparency: Refraction on Reflection: Fresnel on and Ray trace on
  ILLUM07 = 7,
  // Reflection on and Ray trace off
  ILLUM08 = 8,
  // Transparency: Glass on Reflection: Ray trace off
  ILLUM09 = 9,
  // Casts shadows onto invisible surfaces
  ILLUM10 = 10,
}

type illumExpr = {
  ident: "illum";
  params: {
    model: IllumModels;
  };
};

export type MTLPayload =
  | CommentExpr
  | NewMTLExpr
  | NsExpr
  | KaExpr
  | KdExpr
  | KsExpr
  | KeExpr
  | NiExpr
  | dExpr
  | TrExpr
  | illumExpr;

type MTLIdents = MTLPayload["ident"];

function isNumeric(text: string) {
  const num = Number(text);
  return Number.isNaN(num) ? null : num;
}

function assertToken(valid: boolean, msg: string): asserts valid {
  if (!valid) {
    throw new OBJParserError(msg);
  }
}

function parseOBJLine(expression: string): OBJPayload {
  const words = expression.trim().replace(/ +/g, " ").split(" ");
  const tokens = new TokenStream(words);

  const head = tokens.nextOpt();
  assertToken(head != null, "expression is empty");

  switch (head as OBJIdents) {
    case "#":
      return tokenComment(tokens);
    case "mtllib":
      return tokenMtllib(tokens);
    case "v":
      return tokenVertex(tokens);
    case "f":
      return tokenFace(tokens);
    case "vt":
      return tokenVtTexture(tokens);
    case "vn":
      return tokenVNormal(tokens);
    case "usemtl":
      return tokenUseMtl(tokens);
    case "s":
      throw new OBJImplMissing(`Implementation pending: '${head}'`);
    case "o":
      throw new OBJImplMissing(`Implementation pending: '${head}'`);
    case "g":
      throw new OBJImplMissing(`Implementation pending: '${head}'`);
    default:
      throw new OBJParserError(`Unrecognized function found: '${head}'`);
  }
}

function parseMTLLine(expression: string): MTLPayload {
  const words = expression.trim().replace(/ +/g, " ").split(" ");
  const tokens = new TokenStream(words);

  const head = tokens.nextOpt();
  assertToken(head != null, "expression is empty");

  switch (head as MTLIdents) {
    case "newmtl":
      return tokenNewMTL(tokens);
    case "Ns":
      return tokenNsMat(tokens);
    case "Ka":
      return tokenKaMat(tokens);
    case "Kd":
      return tokenKdMat(tokens);
    case "Ks":
      return tokenKsMat(tokens);
    case "Ke":
      return tokenKeMat(tokens);
    case "Ni":
      return tokenNiMat(tokens);
    case "d":
      return tokendMat(tokens);
    case "Tr":
      return tokenTrMat(tokens);
    case "illum":
      return tokenIllumMat(tokens);
    case "#":
      return tokenComment(tokens);
    default:
      throw new MTLParserError(`Unrecognized function found: '${head}'`);
  }
}

function tokenNewMTL(tokens: TokenStream): NewMTLExpr {
  const words: string[] = [];
  for (; tokens.remaining > 0; words.push(tokens.next())) {}
  return {
    ident: "newmtl",
    params: {
      name: words.join(" "),
    },
  };
}

function tokenNsMat(tokens: TokenStream): NsExpr {
  assertToken(
    tokens.remaining === 1,
    `'Ns' expects 1 parameter, ${tokens.remaining} found`,
  );

  const specularWeight = isNumeric(tokens.next());
  assertToken(specularWeight != null, "specular weight not numeric");

  return {
    ident: "Ns",
    params: {
      specularWeight,
    },
  };
}

function tokenKaMat(tokens: TokenStream): KaExpr {
  assertToken(
    tokens.remaining === 3,
    `'Ns' expects 3 parameter, ${tokens.remaining} found`,
  );

  const red = isNumeric(tokens.next());
  assertToken(red != null, "red value not numeric");
  const green = isNumeric(tokens.next());
  assertToken(green != null, "green value not numeric");
  const blue = isNumeric(tokens.next());
  assertToken(blue != null, "blue value not numeric");

  return {
    ident: "Ka",
    params: {
      ambientColor: [red, green, blue],
    },
  };
}

function tokenKdMat(tokens: TokenStream): KdExpr {
  assertToken(
    tokens.remaining === 3,
    `'Kd' expects 3 parameter, ${tokens.remaining} found`,
  );

  const red = isNumeric(tokens.next());
  assertToken(red != null, "red value not numeric");
  const green = isNumeric(tokens.next());
  assertToken(green != null, "green value not numeric");
  const blue = isNumeric(tokens.next());
  assertToken(blue != null, "blue value not numeric");

  return {
    ident: "Kd",
    params: {
      diffuseColor: [red, green, blue],
    },
  };
}

function tokenKsMat(tokens: TokenStream): KsExpr {
  assertToken(
    tokens.remaining === 3,
    `'Ks' expects 3 parameter, ${tokens.remaining} found`,
  );

  const red = isNumeric(tokens.next());
  assertToken(red != null, "red value not numeric");
  const green = isNumeric(tokens.next());
  assertToken(green != null, "green value not numeric");
  const blue = isNumeric(tokens.next());
  assertToken(blue != null, "blue value not numeric");

  return {
    ident: "Ks",
    params: {
      specularColor: [red, green, blue],
    },
  };
}

function tokenKeMat(tokens: TokenStream): KeExpr {
  assertToken(
    tokens.remaining === 3,
    `'Ke' expects 3 parameter, ${tokens.remaining} found`,
  );

  const red = isNumeric(tokens.next());
  assertToken(red != null, "red value not numeric");
  const green = isNumeric(tokens.next());
  assertToken(green != null, "green value not numeric");
  const blue = isNumeric(tokens.next());
  assertToken(blue != null, "blue value not numeric");

  return {
    ident: "Ke",
    params: {
      emissiveColor: [red, green, blue],
    },
  };
}

function tokenNiMat(tokens: TokenStream): NiExpr {
  assertToken(
    tokens.remaining === 1,
    `'Ni' expects 1 parameter, ${tokens.remaining} found`,
  );

  const indexOfRefraction = isNumeric(tokens.next());
  assertToken(indexOfRefraction != null, "refraction index not numeric");

  return {
    ident: "Ni",
    params: {
      indexOfRefraction,
    },
  };
}

function tokendMat(tokens: TokenStream): dExpr {
  assertToken(
    tokens.remaining === 1,
    `'d' expects 1 parameter, ${tokens.remaining} found`,
  );

  const alpha = isNumeric(tokens.next());
  assertToken(alpha != null, "dissolve value not numeric");

  return {
    ident: "d",
    params: {
      alpha,
    },
  };
}

function tokenTrMat(tokens: TokenStream): TrExpr {
  assertToken(
    tokens.remaining === 1,
    `'Tr' expects 1 parameter, ${tokens.remaining} found`,
  );

  const transparency = isNumeric(tokens.next());
  assertToken(transparency != null, "transparency value not numeric");

  return {
    ident: "Tr",
    params: {
      transparency,
    },
  };
}

function tokenIllumMat(tokens: TokenStream): illumExpr {
  assertToken(
    tokens.remaining === 1,
    `'Tr' expects 1 parameter, ${tokens.remaining} found`,
  );

  const model = isNumeric(tokens.next());
  assertToken(
    model != null && Number.isInteger(model),
    "transparency value not integer",
  );
  assertToken(model >= 0 && model <= 10, "not a valid illumination model");
  model as IllumModels;

  // vertex != null && vertex !== 0 && Number.isInteger(vertex),
  return {
    ident: "illum",
    params: {
      model,
    },
  };
}

function tokenUseMtl(tokens: TokenStream): UseMtlExpr {
  const words: string[] = [];
  for (; tokens.remaining > 0; words.push(tokens.next())) {}
  return {
    ident: "usemtl",
    params: {
      name: words.length > 0 ? words.join(" ") : null,
    },
  };
}

function tokenMtllib(tokens: TokenStream): MTLExpr {
  // BUGBUG: if the filename contains more than one space in its name
  // this function would fail. The tokenizer throws it away.

  const words: string[] = [];
  for (; tokens.remaining > 0; words.push(tokens.next())) {}

  return {
    ident: "mtllib",
    params: {
      filename: words.join(" "),
    },
  };
}

function tokenComment(tokens: TokenStream): CommentExpr {
  let words = [];
  for (; tokens.remaining > 0; words.push(tokens.next())) {}
  return {
    ident: "#",
    params: {
      message: words.join(" "),
    },
  };
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
