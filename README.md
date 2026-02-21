# CS174C - Final Project

## Name: TBD

Members:
- Adrian Pu
- Kyle Deveaux
- Mario Flores

A bumper-cars inspired game implemented using tiny-graphics with a typescript layer on top. The goal of the game is to damage your opponent to deplete their health to 0 first.

### TODOs

A tentative and non-exhaustive TODO list

- [ ] add library to manage kinematic chains
  - [x] integrate mesh for saw arm with armature
  - [ ] create a function to make the arm swing forward or back ward (think of a scorpion strikes)
  - [ ] create a function to manage wheel rotation
  - [ ] create a function to manage steer rotation (see link for steer geometry below)
- [ ] create a way to manage the game state
  - [ ] timer for game cycle
  - [ ] health of each car
- [ ] add a library to manage mass-spring-damper (MSD) frame
  - [ ] add a way to assign signed distance fields to nodes (search Inigo Quilez)
  - [ ] add a rolling-friction model assignable to nodes (for tires)
  - [ ] allow arbitrary external forces for the particles
  - [ ] synchronize MSD frame position-direction with cart armature
  - [ ] create MSD-frames for both vehicles
- [ ] add a shader that shows a GUI
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
- rigid body physics
  - simulate in 2D; render in 3D
  - use stacked circles to make the "oval" shape of the cart
- particle beam collision detection
  - triangle intersection is the easiest
  - use bounding box for cart instead of the mesh (less triangle transformations)
- steering
  - ~~let's simply manage 4 contact patches.~~
    - ~~The rear patches provide thrust~~
    - ~~the front patches provide steering through lateral grip~~
    - reference for steering geometry: https://www.desmos.com/calculator/rnlmx54x2f
  - now it can be handled by the MSD-system
- structure of MSD-frame
  - make the body a trussed extruded oval for rigidity
  - connect the tire nodes below with a two nodes to the body
    - single node per tire
    - the floor is touched by only 4 nodes
    - add most weight to the tires to prevent it flipping over
    - add a cross truss to the the tires for stiffness

### Game Specs

#### Car Dimensions

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

These are the **base** dimensions expected by `CartArmature`
- cylinder: (`x: [-1, 1], y: [-1, 1], z: [-0.5, 0.5]`)
- disc: (`x: [-1, 1], y: [-1, 1], z: [0, 0]`)
- cube: (`x: [-1, 1], y: [-1, 1], z: [-1, 1]`)

Use these as reference to prepare meshes and/or textures. For example, if you have a nice mesh/texture, make sure that the base shape you feed to the constructor is a tire bounded tightly by the cylinder above. There are two options to make this easy
1. edit in blender before importing
2. create a mesh loader that let's you pre-apply a transformation to the raw vertices.

### Game Description

Our game will be based on Bumper Cars. It is a 2-player game where the goal of the game is to damage your opponent to deplete their health to 0 first. The arena is a square with rounded sides and the camera is a fixed top down view to allow both players to see their car. Crashing mindlessly depletes both your and the other car's health. The game provides randomly generated power-ups which can be collected and provide the player different powers which can be:

1. mass increase for a few seconds
2. instant speed boost
3. a mechanic arm with a saw: it appears on top of the car while active for 20 seconds, and during that time it requires user input to "pound" in front or behind it.
4. particle beam: a wide range barrage of particles that lasts for 20 seconds, and the user can select for it to shoot from the front or the rear. The particles collide with the opponent causing it to lose speed and receive damage

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
