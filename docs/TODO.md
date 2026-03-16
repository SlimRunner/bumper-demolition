- [TODO](#todo)
  - [Main Roadmap](#main-roadmap)
  - [Algorithms](#algorithms)
  - [Extras](#extras)

# TODO

## Main Roadmap

A tentative and non-exhaustive TODO list

- [x] add library to manage kinematic chains
  - [x] integrate mesh for saw arm with armature
  - [x] create a function to make the arm swing forward or back ward (think of a scorpion strikes)
  - [x] create a function to manage wheel rotation
  - [x] create a function to manage steer rotation (see link for steer geometry below)
- [x] create a way to manage the game state
  - [x] timer for game cycle
  - [x] health of each car
  - [x] allow game to be reset
  - [x] manage game cycling transition
  - [x] add a sudden death circle of death
- [x] add a library to manage mass-spring-damper (MSD) frame
  - [x] add a way to assign signed distance fields to nodes (search Inigo Quilez)
  - [x] add a rolling-friction model assignable to nodes (for tires)
  - [x] allow arbitrary external forces for the particles
  - [x] synchronize MSD frame position-direction with cart armature
  - [x] create MSD-frames for both vehicles
- [x] add a GUI (either CSS or Shader)
  - [x] show health bars above (fighter game-like)
  - [x] allow printing text to screen
    - [x] show timer in between health bars
    - [x] show WIN toast at the end
  - [x] tracking score
- [x] prettify game
  - [x] find nice meshes
    - [x] arena floor
    - [x] arena walls
    - [x] wheels
    - [x] arm-links
    - [x] body
    - [x] saw
  - [x] add texturing
    - [x] arena floor
    - [x] arena walls
    - [x] wheels
      - [x] add texture (optional currently you can barely see they spin)
    - [x] arm-links
    - [x] body
    - [x] saw
  - [x] add nice shaders
    - [x] skybox
    - [x] normal mapping
    - [x] specular mapping
    - [x] orbiting particles (single vertex)
  - [x] add sound
    - [x] engine sound
    - [x] collision sound
    - [x] music?

## Algorithms

- [x] Mass-Spring-Damper Systems
  - physics simulation [msdSystem](/src/physics/msdSystem.ts)
- [x] Collision Detection and Response
  - manager [cartFrame](/src/physics/cartFrame.ts)
  - convex SDF boundaries [contactFields](/src/physics/contactFields.ts)
- [x] Particle Systems
  - orbits and sparks [cartFrame](/src/physics/cartFrame.ts)
- [x] Articulated Kinematics
  - engine [kinematics](/src/rigging/kinematics.ts)
  - manager [cartArmature](/src/rigging/cartArmature.ts)
- [x] Motion Control With Curves
  - orbits in [cartFrame](/src/physics/cartFrame.ts)
  - cameras in [cameras](/src/cameras/)

## Extras

- [ ] light poles for night time lights
- [ ] add dynamic lighting for orbits and sparks
- [x] add saw blade sound while the blade is running (listener is alredy implemented)
- [x] add a nice intro/outro animation with dynamic cameras
- [x] add explosion animation when player is defeated
