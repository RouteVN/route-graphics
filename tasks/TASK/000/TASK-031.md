---
title: support animated spritesheets
status: todo
priority: medium
assignee: nghia
labels: [feat]
---

# Description

We have decided to not support GIF. instead support only spritesheets. for animating images, that can be looped.

so we need to implment animated spritesheet as a new element type

## Summary

Sprite sheets with PNG + JSON (or similar metadata formats) are definitely the dominant approach for 2D game animations, but the landscape is a bit more nuanced:
Why sprite sheets dominate in games:

Direct GPU texture access (fast rendering)
Frame-perfect timing control
Works seamlessly with game engines (Unity, Godot, GameMaker, etc.)
Small memory footprint when optimized
Tools like TexturePacker, Aseprite, and Spine export this way

What about the alternatives?

- GIF — Almost never used in actual games. No alpha transparency, limited colors (256), poor compression, and no random frame access. Fine for marketing assets or Discord emotes, not runtime.

- Bodymovin/Lottie — Used more in mobile apps and UI than games. It's vector-based and great for scalable motion graphics, but most game engines don't natively support it and it's overkill for pixel art or typical game sprites.

- Spine / DragonBones / Creature  These are skeletal animation tools that output their own JSON + texture atlas formats. Very common in 2D games with complex characters (think Hollow Knight-style fluid movement). They're arguably more popular than frame-by-frame sprite sheets for character animation in professional 2D games now.

- Video files (MP4, WebM) — Sometimes used for cutscenes or full-screen effects, but rarely for gameplay sprites.

So yes, "PNG + JSON" is the de facto general format, but skeletal animation (Spine especially) has carved out a huge space for character work. The choice often comes down to art style and animation complexity

## Reference

example:

https://pixijs.com/8.x/examples?example=animated-sprite_spritesheet


old 7.x docs:
https://pixijs.com/7.x/guides/components/sprite-sheets
