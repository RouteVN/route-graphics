---
template: docs-documentation
title: Introduction
tags: documentation
sidebarId: introduction
---

Route Graphics is a declarative rendering engine built on PixiJS.

You describe UI with JSON states, then render transitions between states without directly manipulating canvas objects.

This documentation is organized around the actual runtime surfaces:

- setup and asset loading
- global config and events
- node reference pages
- live playground templates you can edit immediately

## What It Handles

- Element lifecycle: add, update, and delete
- Animations: tween-driven transitions
- Interaction events: click, hover, drag, keyboard
- Audio: sound asset playback
- Deterministic parsing and render pipeline

## Typical Flow

1. Initialize Route Graphics with plugins.
2. Load assets through aliases.
3. Call `render(state)` with `elements`, `animations`, `audio`, and optional `global`.
4. Push the next state to transition UI.

Continue with [Getting Started](/docs/introduction/getting-started/) for a minimal setup, then use [Assets & Loading](/docs/guides/assets-loading/) and [Using the Playground](/docs/guides/playground/) as the practical next steps.
