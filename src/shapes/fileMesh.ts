import { createError } from "../utils/error";

export const OBJParserError = createError("OBJParserError");

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

type FaceIndexPack = {
  vertex: number;
  texture: number;
  normal: number;
};

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
      return tokenDummy(tokens);
    case "v":
      return tokenVertex(tokens);
    case "f":
      return tokenFace(tokens);
    case "vt":
      return tokenVtTexture(tokens);
    case "vn":
      return tokenVNormal(tokens);
    case "usemtl":
      return tokenDummy(tokens);
    case "s":
      return tokenDummy(tokens);
    case "o":
      return tokenDummy(tokens);
    case "g":
      return tokenDummy(tokens);
    default:
      assertToken(false, `Unrecognized function found ${head}`);
  }
}

function tokenVertex(tokens: TokenStream): VertexExpr {
  assertToken(
    tokens.remaining === 3,
    `'v' expects 3 parameters, ${tokens.remaining} found`,
  );

  const x = isNumeric(tokens.next());
  assertToken(x != null, "");
  const y = isNumeric(tokens.next());
  assertToken(y != null, "");
  const z = isNumeric(tokens.next());
  assertToken(z != null, "");

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
  assertToken(x != null, "");
  const y = isNumeric(tokens.next());
  assertToken(y != null, "");
  const z = isNumeric(tokens.next());
  assertToken(z != null, "");

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
  assertToken(u != null, "");
  const v = isNumeric(tokens.next());
  assertToken(v != null, "");

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
    `'f' expects 3 parameters, ${tokens.remaining} found`,
  );

  const params: FaceIndexPack[] = [];

  for (let i = 0; i < 3; ++i) {
    const vInfo = new TokenStream(tokens.next().split("/"));
    assertToken(vInfo.remaining === 3, `only 'v/vt/vn' is supported`);
    const vertex = isNumeric(vInfo.next());
    assertToken(vertex != null && vertex >= 0 && Number.isInteger(vertex), "");
    const texture = isNumeric(vInfo.next());
    assertToken(
      texture != null && texture >= 0 && Number.isInteger(texture),
      "",
    );
    const normal = isNumeric(vInfo.next());
    assertToken(normal != null && normal >= 0 && Number.isInteger(normal), "");

    params.push({
      normal,
      texture,
      vertex,
    });
  }

  return {
    ident: "f",
    params: {
      indices: [params[0], params[1], params[2]],
    },
  };
}

function tokenDummy(tokens: TokenStream): exprPayload {
  assertToken(false, "not implemented yet");
}
