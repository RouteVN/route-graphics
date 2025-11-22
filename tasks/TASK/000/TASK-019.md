---
title: Research and implement solution for things like rain, snow effects
status: todo
priority: low
---

# Description

## Context

Currently, route-graphics supports mostly static assets, and some tween animations.
In Visual Novels there is usually effects like rain, snow etc... that create a more immersive atmosphere. We want route-graphics to support such functionality.

## Research

Research the following:

- How to impement rain and snow effects in PixiJS. Can we do this within PixJS or need something external?
- Understand the limitations and possibilities we have
- Anything we can learn from other Visual Novel engines, how do they implement it

## Requirements

- Although we want support rain and snow effects, we want to be able it to be very flexible and able to support all kinds of different effects and customizations
- We want to design a configuration/API that is easy enough to use for the user

## Plan

Fill in here the implementation plan after the research has been conducted

For snow and rain which is made of lots of particles, using Particle and ParticleContainer provided by PixiJS would be the best match, since already using PixiJS and we don't need to import new engines.
Similar to other visual novel engines, we can provide presets while also opening the permission to modify detailed fields of particles (e.g. movement direction, speed).
This ensures that it is easily extendable and easy for users to use.
One limitation is that immersive secenes other than lots of particles may need to be implemented in another way.