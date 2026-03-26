import { defs as ShaderNamespace } from "./common-shaders";
import { defs as ShapeNamespace } from "./common-shapes";
import { defs as CompNamespace } from "./common-components";
import { math } from "../tiny-graphics-math";
import {
  GPUAddresses,
  tiny as TinyNamespace,
} from "../tiny-graphics";

export namespace defs {
  // current common is empty

  export import Basic_Shader = ShaderNamespace.Basic_Shader;
  export import Fake_Bump_Map = ShaderNamespace.Fake_Bump_Map;
  export import Phong_Shader = ShaderNamespace.Phong_Shader;
  export import Textured_Phong = ShaderNamespace.Textured_Phong;

  export import Triangle = ShapeNamespace.Triangle;
  export import Square = ShapeNamespace.Square;
  export import Tetrahedron = ShapeNamespace.Tetrahedron;
  export import Windmill = ShapeNamespace.Windmill;
  export import Cube = ShapeNamespace.Cube;
  export import Subdivision_Sphere = ShapeNamespace.Subdivision_Sphere;
  export import Grid_Patch = ShapeNamespace.Grid_Patch;
  export import Surface_Of_Revolution = ShapeNamespace.Surface_Of_Revolution;
  export import Regular_2D_Polygon = ShapeNamespace.Regular_2D_Polygon;
  export import Cylindrical_Tube = ShapeNamespace.Cylindrical_Tube;
  export import Cone_Tip = ShapeNamespace.Cone_Tip;
  export import Torus = ShapeNamespace.Torus;
  export import Grid_Sphere = ShapeNamespace.Grid_Sphere;
  export import Closed_Cone = ShapeNamespace.Closed_Cone;
  export import Rounded_Closed_Cone = ShapeNamespace.Rounded_Closed_Cone;
  export import Capped_Cylinder = ShapeNamespace.Capped_Cylinder;
  export import Rounded_Capped_Cylinder = ShapeNamespace.Rounded_Capped_Cylinder;
  export import Axis_Arrows = ShapeNamespace.Axis_Arrows;
  export import Minimal_Shape = ShapeNamespace.Minimal_Shape;
  // export import Shape_From_File = ShapeNamespace.Shape_From_File;

  export import Movement_Controls = CompNamespace.Movement_Controls;
}
