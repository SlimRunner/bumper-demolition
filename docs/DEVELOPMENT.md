- [Development](#development)
  - [Setup](#setup)
  - [Code Restrictions](#code-restrictions)
  - [Game Specs](#game-specs)
    - [Car Dimensions](#car-dimensions)

# Development

This page covers how to get the project setup to get started making changes to the code.

## Setup

1. run `npm install` to setup node
2. run `npm run build` to build or `npm run dev` for continous build
3. run `python ./sever.py` to start the web server in local host port 8000

> NOTE: building takes about 4 seconds because of the script to fix import references (adds the `.js`).

## Code Restrictions

There are some unfortunate restrictions in the way you can code that arise from preserving tiny-graphics unorthodox project structure while using TypeScript.

1. Make sure that you **import only using relative paths for all files and do not use extensions**.
   ```ts
   // example
   import { tiny } from "../tiny-graphic";
   import { math } from "../tiny-graphics-math";
   import { defs } from "../examples/common";
   import { myTSLib } from "./library/some-ts-file"
   // NOTE that tiny-graphics "encourages" to import `tiny` and `math`
   // from common but these are not changed at all, so it is pointless.
   // The declaration file was simplified and prevents this so just
   // import from their actual source
   ```
2. All the code should be contained in `src`. The output is perfectly mirrored in `my-code`.

The reason for the import requirement is to enable jest testing (in case we might need it), but still allow the references to be trivially fixable since the provided server blocks `.ts` extensions or lack there of (it cannot do resolution).

## Game Specs

### Car Dimensions

You can find and/or tune the find dimensions in the constructor of `BumperCarsBase`. In short they use the following primitive meshes as basis

| part      | mesh     |
| --------- | -------- |
| arm 1     | cylinder |
| arm 2     | cylinder |
| chassis   | cube     |
| saw blade | disc     |
| wheels    | cylinder |

> note: for tires the outward edge looks towards +Z

These are the **base** dimensions expected by `CartArmature`
- cylinder: (`x: [-1, 1], y: [-1, 1], z: [-0.5, 0.5]`)
- disc: (`x: [-1, 1], y: [-1, 1], z: [-u, u]`)
- cube: (`x: [-1, 1], y: [-1, 1], z: [-1, 1]`)

Use these as reference to import meshes and/or textures. In other words for the meshes to render correctly make sure the bounding box of the mesh is inscribed in the boundaries detailed above. There are two options to make this easy

1. transform in a 3d modeling software before importing
2. take advantage of [FileMesh](/src/shapes/fileMesh.ts) constructor to pre-apply transformation
