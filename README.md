- [CS174C - Bumper Demolition](#cs174c---bumper-demolition)
  - [Members](#members)
  - [Overview](#overview)
  - [How To Run](#how-to-run)
  - [Extended Description](#extended-description)
  - [Documentation](#documentation)

# CS174C - Bumper Demolition

## Members

- Adrian Pu
- Kyle Deveaux
- Mario Flores

## Overview

A bumper-cars inspired game implemented using tiny-graphics with a typescript layer on top. The goal of the game is to damage your opponent to deplete their health to 0 first.

## How To Run

For the grader it should run exactly like a default tiny-graphics assignment. For development and TS source code see [the documentation below](#documentation).

## Extended Description

Our game will be based on Bumper Cars. It is a 2-player game where the goal of the game is to damage your opponent to deplete their health to 0 first. The arena is a square with rounded sides and the camera is a fixed top down view to allow both players to see their car. Crashing mindlessly depletes both your and the other car's health. The game provides randomly generated power-ups which can be collected and provide the player different powers which can be:

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

## Documentation

Refer to

- [Development](/docs/DEVELOPMENT.md)
- [TODO](/docs/TODO.md)
