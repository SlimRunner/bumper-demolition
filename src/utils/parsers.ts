import { createError } from "./error";
import { TokenStream } from "./text";

export const OBJParserError = createError("OBJParserError");
export const OBJImplMissing = createError("OBJImplMissing");
export const MTLParserError = createError("MTLParserError");
export const MTLImplMissing = createError("MTLParserError");

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

export type FaceIndexPack =
  | FacePack_V
  | FacePack_VT
  | FacePack_VTN
  | FacePack_VN;

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

type MapKdExpr = {
  ident: "map_Kd";
  params: { filename: string };
};

type MapNsExpr = {
  ident: "map_Ns";
  params: { filename: string };
};

type MapBumpExpr = {
  ident: "map_bump";
  params: { filename: string };
};

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
  | illumExpr
  | MapKdExpr
  | MapNsExpr
  | MapBumpExpr;

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

export function parseOBJLine(expression: string): OBJPayload {
  const tokens = new TokenStream(expression, OBJParserError);

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

export function parseMTLLine(expression: string): MTLPayload {
  const tokens = new TokenStream(expression, MTLParserError);

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
    case "map_Kd":
      return tokenKdMap(tokens);
    case "map_Ns":
      return tokenKsMap(tokens);
    case "map_bump":
      return tokenBumpMap(tokens);
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

function tokenKdMap(tokens: TokenStream): MapKdExpr {
  const words: string[] = [];
  for (; tokens.remaining > 0; words.push(tokens.next(true))) {}

  return {
    ident: "map_Kd",
    params: {
      filename: words.join("").trim(),
    },
  };
}

function tokenKsMap(tokens: TokenStream): MapNsExpr {
  const words: string[] = [];
  for (; tokens.remaining > 0; words.push(tokens.next(true))) {}

  return {
    ident: "map_Ns",
    params: {
      filename: words.join("").trim(),
    },
  };
}

function tokenBumpMap(tokens: TokenStream): MapBumpExpr {
  const words: string[] = [];
  for (; tokens.remaining > 0; words.push(tokens.next(true))) {}

  return {
    ident: "map_bump",
    params: {
      filename: words.join("").trim(),
    },
  };
}

function tokenUseMtl(tokens: TokenStream): UseMtlExpr {
  const words: string[] = [];
  for (; tokens.remaining > 0; words.push(tokens.next(true))) {}
  return {
    ident: "usemtl",
    params: {
      name: words.length > 0 ? words.join("").trim() : null,
    },
  };
}

function tokenMtllib(tokens: TokenStream): MTLExpr {
  const words: string[] = [];
  for (; tokens.remaining > 0; words.push(tokens.next(true))) {}

  return {
    ident: "mtllib",
    params: {
      filename: words.join("").trim(),
    },
  };
}

function tokenComment(tokens: TokenStream): CommentExpr {
  let words = [];
  for (; tokens.remaining > 0; words.push(tokens.next(true))) {}
  return {
    ident: "#",
    params: {
      message: words.join("").trim(),
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
    const vInfo = new TokenStream(tokens.next(), OBJParserError, {
      separator: /\//g,
    });

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
