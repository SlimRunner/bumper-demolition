# CS174C - Final Project

## Name: TBD

Members:
- Adrian Pu
- Andy Kasbarian
- Kyle Deveaux
- Mario Flores

A bumper-cars inspired game implemented using tiny-graphics with a typescript layer on top. The goal of the game is to damage your opponent to deplete their health to 0 first.

### TODOs

A tentative and non-exhaustive TODO list

- [ ] add library to manage kinematic chains
  - [ ] integrate mesh for saw arm with armature
  - [ ] create a function to make the arm swing forward or back ward (think of a scorpion strikes)
- [ ] create a way to manage the game state
  - [ ] timer for game cycle
- [ ] add a library to manage rigid body physics
  - [ ] allow friction and thrust forces for the tires
  - [ ] allow arbitrary external forces for the particles
  - [ ] detect collision (optionally allow a callback)
- [ ] create library to manage turning and accelerating

Proposals for implementation
- rigid body physics
  - simulate in 2D; render in 3D
  - use stacked circles to make the "oval" shape of the cart
- particle beam collision can be detected in 3D then projected onto a plane for the 2D engine
  - triangle intersection is the easiest
  - use bounding box for cart instead of the mesh (less triangle transformations)
- steering
  - let's simply manage 4 contact patches.
    - The rear patches provide thrust
    - the front patches provide steering through lateral grip
    - reference for steering geometry: https://www.desmos.com/calculator/rnlmx54x2f

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
