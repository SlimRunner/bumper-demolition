- [CS174C - Final Project](#cs174c---final-project)
  - [Name: TBD](#name-tbd)
    - [TODOs](#todos)
    - [Game Description](#game-description)
  - [Setup](#setup)
  - [Development](#development)
  - [Game Specs](#game-specs)
    - [Car Dimensions](#car-dimensions)
  - [Documentation](#documentation)
    - [Textures](#textures)
    - [Resources](#resources)

# CS174C - Final Project

## Name: TBD

Members:
- Adrian Pu
- Kyle Deveaux
- Mario Flores

A bumper-cars inspired game implemented using tiny-graphics with a typescript layer on top. The goal of the game is to damage your opponent to deplete their health to 0 first.

### TODOs

A tentative and non-exhaustive TODO list

- [x] add library to manage kinematic chains
  - [x] integrate mesh for saw arm with armature
  - [x] create a function to make the arm swing forward or back ward (think of a scorpion strikes)
  - [x] create a function to manage wheel rotation
  - [x] create a function to manage steer rotation (see link for steer geometry below)
- [ ] create a way to manage the game state
  - [ ] timer for game cycle
  - [ ] health of each car
  - [x] allow game to be reset
- [ ] add a library to manage mass-spring-damper (MSD) frame
  - [x] add a way to assign signed distance fields to nodes (search Inigo Quilez)
  - [x] add a rolling-friction model assignable to nodes (for tires)
  - [ ] allow arbitrary external forces for the particles
  - [x] synchronize MSD frame position-direction with cart armature
  - [x] create MSD-frames for both vehicles
- [ ] add a GUI (either CSS or Shader)
  - [ ] show health bars above (fighter game-like)
  - [ ] allow printing text to screen
    - [ ] show timer in between health bars
    - [ ] show WIN toast at the end
- [ ] prettify game
  - [ ] find nice meshes/textures (off the internet?)
    - [ ] wheels
    - [ ] arm-links
    - [ ] body
    - [ ] saw

Proposals for implementation
- particle beam collision detection
  - add kinetic particles to the MSD system and use car SDF colliders (use tags)
  - implement a drawable for the subset of these particles (use tags)
- For the GUI
  - preferably use CSS: shaders would be cleaner but that is making a GUI from scratch and other group already used CSS so probably we don't have to.
  - Make sure you make the elements children of canvas. This is loaded in the base constructor of main

### Game Description

Our game will be based on Bumper Cars. It is a 2-player game where the goal of the game is to damage your opponent to deplete their health to 0 first. The arena is a square with rounded sides and the camera is a fixed top down view to allow both players to see their car. Crashing mindlessly depletes both your and the other car's health. The game provides randomly generated power-ups which can be collected and provide the player different powers which can be:

1. mass increase for a few seconds
2. instant speed boost
3. a mechanic arm with a saw: it appears on top of the car while active for 20 seconds, and during that time it requires user input to "pound" in front it.
4. particle cloud: a cluster of orbiting particles that lasts for 20 seconds, and it causes damage to the opponent if these hit. Each hit "consumes" the particle.

The game has a 5 minute time limit. If at the end of that time no player has won, two large circular saws being to close-in from the sides until they meet in the middle. Touching causes great damage. The saws take 1 minute from the time they appear until they meet at the middle.

The gameplay cycle:
1. Game starts with both cars looking at each other on opposite ends of the arena (they both have a power up in front)
2. 3 second countdown to start game
3. The game continues for 5 minutes until one player dies
4. After time limit the arena starts closing for a extra 1 minute
5. After winner is announced return to 1

## Setup

First install the node packages
```sh
npm install
```

Then open a terminal to run nodemon for continuous building
```sh
npm run dev
```

Or if you just want to build once
```sh
npm run build
```

That will generate all the JS output in a directory called [my-code](./my-code/). Be aware that code in this folder should not be modified directly and is also not git-tracked.

Finally open a second terminal and execute the default provided script to run localhost
```sh
python server.py
# or ./host.*
```

> NOTE: building takes about 4 seconds because of the script to fix import references (adds the `.js`).

## Development

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

The reason for the import requirement is to enable jest testing (in case we might need it), but still allow the references to be trivially fixable since tiny graphics crashes if you do not import using `.js`.

## Game Specs

### Car Dimensions

You can find and/or tune the find dimensions in the constructor of `BumperCarsBase`. These are
- wheelbase: distance between front and back wheel center
- axleTrack: distance between the right and left wheel centers
- rimSize: diameter of the metal part of the rim (not used directly)
- tireWallSize: size of the tire sidewall (not used directly)
- tireWidth: self explanatory
- chassisHeight: height of the car body (without wheels)
- armLinkLength: size of *both* links for the jointed arm
- armLinkRadius: radius of *both* links for the jointed arm
- sawRadius: radius of saw blade

The above are currently assigned the following primitive meshes
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
- disc: (`x: [-1, 1], y: [-1, 1], z: [0, 0]`)
- cube: (`x: [-1, 1], y: [-1, 1], z: [-1, 1]`)

Use these as reference to prepare meshes and/or textures. For example, if you have a nice mesh/texture, make sure that the base shape you feed to the constructor is a tire bounded tightly by the cylinder above. There are two options to make this easy
1. edit in blender before importing
2. create a mesh loader that let's you pre-apply a transformation to the raw vertices.

## Documentation

### Textures

I added a skybox and "complex" texture shader. The latter is a combination of diffuse texture mapping + normal mapping + specular mapping. Essentially you load three textures to define the shader. Here is a snippet of how to load it
```ts
export class BumperCarsBase extends tiny.Component {
  // ...
  materials: {
    // ...
    skybox: {
      shader: SkyboxWH;
      sun_zenith: number;
      sun_azimuth: number;
    };
    stoneMat: {
      shader: ComplexTextured;
    } & CplxMats;
  }

  constructor() {
    // ...

    this.materials = {
      // ...
      skybox: {
        shader: new SkyboxWH(),
        sun_azimuth: 0,
        sun_zenith: Math.PI * 0.45,
      },
      stoneMat: {
        shader: new ComplexTextured(),
        ambient: 0.4,
        diffusivity: 4,
        specularity: 2,
        bumpiness: 1,
        ambient_color: math.color(0.5, 0.5, 0.5, 1),
        texture: new tiny.Texture(
          "../assets/textures/asphalt/color_map.jpg",
          "LINEAR_MIPMAP_LINEAR",
        ),
        spec_map: new tiny.Texture(
          "../assets/textures/asphalt/spec_map.jpg",
          "LINEAR_MIPMAP_LINEAR",
        ),
        bump_map: new tiny.Texture(
          "../assets/textures/asphalt/normal_map.jpg",
          "LINEAR_MIPMAP_LINEAR",
        ),
      },
    }
  }
};
```

You use them the same you'd use any other shader. The skybox is off course recommended on a box with z-buffer disabled that follows the camera.

For the skybox if you want to sync an sun-type light with it you can do
```ts
const { sun_azimuth, sun_zenith } = this.materials.skybox;
const light_dir = math.vec4(
  10 * Math.sin(sun_zenith) * Math.cos(sun_azimuth),
  10 * Math.cos(sun_zenith),
  10 * Math.sin(sun_zenith) * Math.sin(sun_azimuth),
  0,
);
const light_position = position.to4(1);
this.uniforms.lights = [
  // other lights (remember to update Phong and ComplexTexture constructor for > 2 lights)
  defs.Phong_Shader.light_source(light_dir, math.color(1, 1, 1, 1), 50),
];
```

If you want to update the lighting dynamically you can sample colors of the sky using the TS port in [skyboxUtils.ts](./src/shaders/skyboxUtils.ts).

### Resources

To convert bump maps to normal maps I used this page https://cpetry.github.io/NormalMap-Online/
