---
title: support gif
status: done
priority: low
---

# Description

CANCELLED

- check whether we should re-use Sprite or add a new element type
- reference pixijs code: https://pixijs.com/8.x/examples?example=sprite_gif_animation_loading

we won't support gif at this level.
preferred is into convert gif into PNG sprite sheet + metadata file.

Sprite Sheets (Most Common in Games)
Extract GIF frames into a single PNG sprite sheet + metadata file.
Advantages:

Single texture load, no format decoding overhead
GPU-friendly (batch rendering, texture atlasing)
PNG compression is better than GIF
Full control over frame timing via metadata
Industry standard approach


