import { tiny, Uniforms, MaterialRecord } from "../../tiny-graphics";
import { math } from "../../tiny-graphics-math";
import { normalizeLines, resolveSiblingPath } from "../utils/text";
import { affineTransform, VectorKind } from "../utils/math";
import { loadFile } from "../utils/requests";
import { DrawableShape, ShapeCollection } from "./types";
import { computeTangents } from "./extendMesh";
import {
  FaceIndexPack,
  MTLImplMissing,
  MTLParserError,
  MTLPayload,
  OBJImplMissing,
  OBJParserError,
  OBJPayload,
  parseMTLLine,
  parseOBJLine,
} from "../utils/parsers";
import { ComplexTextured, CplxMats } from "../shaders/complexTexture";
import { ShadowPhong } from "../shaders/shadowPhong";

type _3tuple<T> = [T, T, T];

interface MTLMaterial {
  name: string;
  Ka?: [number, number, number]; // ambient color
  Kd?: [number, number, number]; // diffuse color
  Ks?: [number, number, number]; // specular color
  Ke?: [number, number, number]; // emissive color

  Ns?: number; // specular exponent (0-1000)
  Ni?: number; // optical density
  d?: number; // dissolve/opacity (0-1)
  illum?: number; // illumination model

  map_Kd?: string; // diffuse color map
  map_Ns?: string; // specular highlight map
  map_Bump?: string; // normal map
}

export class FileMesh implements ShapeCollection {
  private _waitCount = 1;
  private _transform?: math.Mat4;
  private _uvscale?: math.Vector<2>;
  private _shaders: Map<string, tiny.Shader> = new Map();
  private _materials: Map<string, MaterialRecord> = new Map();
  // each key is a material name from usemtl; the shape holds that group's geometry
  private _geometries: Map<string, tiny.Shape> = new Map();
  private _lightCount: number;

  constructor(
    filename: string,
    props?: {
      lightCount?: number;
      preTransform?: math.Mat4;
      uvScaling?: math.Vector<2>;
    },
  ) {
    const { lightCount, preTransform, uvScaling } = {
      lightCount: 2,
      ...props,
    };
    this._transform = preTransform;
    this._uvscale = uvScaling;
    this._lightCount = lightCount;
    loadFile(filename)
      .then((file) => {
        this.loadOBJ(file, filename);
      })
      .catch((err) => {
        throw err;
      });
  }

  private get _ready() {
    return this._waitCount === 0;
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
              this.addMaterial(currentMaterial, path);
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
          case "map_Kd":
            if (currentMaterial) {
              currentMaterial.map_Kd = expr.params.filename;
            }
            break;
          case "map_Ns":
            if (currentMaterial) {
              currentMaterial.map_Ns = expr.params.filename;
            }
            break;
          case "map_bump":
            if (currentMaterial) {
              currentMaterial.map_Bump = expr.params.filename;
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
      this.addMaterial(currentMaterial, path);
    }
    this._waitCount -= 1;
  }

  private addMaterial(mtlMat: MTLMaterial, path: string): void {
    if (mtlMat.map_Kd || mtlMat.map_Ns || mtlMat.map_Bump) {
      const shader =
        this._shaders.get(mtlMat.name) ?? new ComplexTextured(this._lightCount);

      const material: CplxMats = {
        shader: shader,

        diffuse_color: mtlMat.Kd
          ? math.color(mtlMat.Kd[0], mtlMat.Kd[1], mtlMat.Kd[2], mtlMat.d ?? 1)
          : math.color(1, 1, 1, 1),

        specular_color: mtlMat.Ks
          ? math.color(mtlMat.Ks[0], mtlMat.Ks[1], mtlMat.Ks[2], 1)
          : math.color(1, 1, 1, 1),

        ambient_color: mtlMat.Ka
          ? math.color(mtlMat.Ka[0], mtlMat.Ka[1], mtlMat.Ka[2], 1)
          : math.color(1, 1, 1, 1),

        ambient: 0.3,
        diffusivity: 1,
        specularity: 1,

        smoothness: mtlMat.Ns ?? 40,
        bumpiness: 1,
      };

      if (mtlMat.map_Kd) {
        const relPath = resolveSiblingPath(path, mtlMat.map_Kd);
        material.texture = new tiny.Texture(relPath);
      }

      if (mtlMat.map_Ns) {
        const relPath = resolveSiblingPath(path, mtlMat.map_Ns);
        material.spec_map = new tiny.Texture(relPath);
      }

      if (mtlMat.map_Bump) {
        const relPath = resolveSiblingPath(path, mtlMat.map_Bump);
        material.bump_map = new tiny.Texture(relPath);
      }
      this._materials.set(mtlMat.name, material);
    } else {
      // Convert MTL material to tiny-graphics Phong material.
      // Kd is a diffuse COLOR (rgb), not a scalar — do not average it for diffusivity.
      // Ks is a specular COLOR (rgb) — average it to get a specularity scalar.
      const shader =
        this._shaders.get(mtlMat.name) ?? new ShadowPhong(this._lightCount);

      const material: MaterialRecord = {
        shader: shader,
        // Kd is the diffuse color; use it directly as the surface color
        color: mtlMat.Kd
          ? math.color(
              mtlMat.Kd[0],
              mtlMat.Kd[1],
              mtlMat.Kd[2],
              mtlMat.d ?? 1.0,
            )
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
    }
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
              console.log("[MTLLIB]: " + expr.params.filename);
              const mtlPath = resolveSiblingPath(path, expr.params.filename);
              this._waitCount += 1;
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
            console.log("[USEMLT]: " + expr.params.name);
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
    this._waitCount -= 1;
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
