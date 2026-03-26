- [Bumper Demolition](#bumper-demolition)
  - [Overview](#overview)
  - [Extended Description](#extended-description)
  - [Attributions](#attributions)
  - [Documentation](#documentation)

# Bumper Demolition

## Overview

A bumper-cars inspired game implemented using tiny-graphics with a typescript layer on top. The goal of the game is to damage your opponent to deplete their health to 0 first.

## Extended Description

A is a 2-player game where the goal of the game is to damage your opponent to deplete their health to 0 first. The arena is a square with rounded sides and the camera is a fixed top down view to allow both players to see their car. Crashing mindlessly depletes both your and the other car's health. The game provides randomly generated power-ups which can be collected and provide the player different powers which can be:

1. mass increase for a few seconds
2. particle cloud: a cluster of orbiting particles that lasts for 20 seconds, and it causes damage to the opponent if these hit. Each hit "consumes" the particle.

In addition each car is equipped with a mechanic arm with a saw. Unlike the power ups which automatically enable on pick up, this one is user controlled. It swings right in front of the car.

The game has a 2 minute time limit. If at the end of that time no player has won, a sudden death stage begins where a circle closes on the arena. Standing outside the cirlce makes constant damage. Only one can come out victorious!

The gameplay cycle:
1. Game starts with both cars looking at each other on opposite ends of the arena (they both have a power up in front)
2. 4 second countdown to start game
3. The game continues 1 minutes and 30 seconds until one player dies
4. After time limit the arena starts closing for 30 seconds
5. After winner is announced return to 1

## Attributions

This project is NOT intended for commercial purposes, but simply to show off the game itself.

The copyrights of the various assets used in this game belong to the respective owners. A good effort was put forth to list them all below. Also, if you are the owner of any of these works, and you wish your work be removed from this game you can open an issue in this repository with your request, and I will promptly remove it.

- Music
  - music
    - [Batman Stage 1 cover by Nestalgica](batmn-stg1-cover)
    - [Batman Stage 1 cover by thebadsociety](batmn-stg1-synth)
    - [Pokemon Champion Zephyr cover by Lala19357](pokemon-lowHp-theme)
  - SketchFab
    - [Low Poly Camper Van by SwordSan](car-model)
    - [Saw Blade by Dogan Kirnaz](saw-blade)
    - [Car wheels and tire by MMC Works](wheel-n-tires)
  - Misc
    - [Deadlock by Valve Software](deadlock-assets): various sounds
    - [Ultrakill by New Blood Interactive](ultrakill-assets): various sounds
    - [Engine Simulator by Ange the Great](engine-sim): engine sound
    - [League of Legends by Riot Games](lol-riot): icons
    - [GTA 5 by Rockstar](gta-wasted): wasted sound
    - [Deltarune by Toby Fox](explosion-sound): explosion

## Documentation

Refer to

- [Development](/docs/DEVELOPMENT.md)
- [TODO](/docs/TODO.md)

[batmn-stg1-cover]: https://youtu.be/JTO5uj1-ND0
[batmn-stg1-synth]: https://youtu.be/exhRZAn7gj0
[pokemon-lowHp-theme]: https://youtu.be/fCiHSZzuwdc
[lol-riot]: https://www.leagueoflegends.com/en-us/
[gta-wasted]: https://www.rockstargames.com/gta-v
[explosion-sound]: https://deltarune.com
[engine-sim]: https://github.com/Engine-Simulator/engine-sim-community-edition/
[ultrakill-assets]: https://store.steampowered.com/app/1229490/ULTRAKILL/
[deadlock-assets]: https://store.steampowered.com/app/1422450/Deadlock
[car-model]: https://skfb.ly/pwVIF
[saw-blade]: https://skfb.ly/oCxDK
[wheel-n-tires]: https://skfb.ly/oAqYG
