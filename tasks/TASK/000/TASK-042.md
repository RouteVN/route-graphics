---
title: add semantic bounds hit testing
status: done
priority: high
labels: [feat, roadmap, api]
---

# Description

Provide the renderer contract required by Figma-style editor selection without
coupling Route Graphics to an editor's authored-selection model.

# Roadmap And Progress

- [x] Define renderer-space hit-test coordinates and the front-to-back result contract.
- [x] Define root-to-deepest semantic paths with transformed quadrilateral bounds.
- [x] Define scroll viewport clipping and zero-opacity participation.
- [x] Implement and expose `hitTestElementBounds()` on the Route Graphics instance.
- [x] Keep hit testing observational and preserve all existing authored interactions.
- [x] Leave occurrence ownership and renderer-element filtering to consumers.
- [x] Add focused regression coverage and public documentation.
- [x] Prepare feature version `1.29.0`.
- [x] Complete final validation and update PR #312.

# Outcome

- Bounds queries use live Pixi transforms, preserve rotated corners, include
  transparent layout bounds, and honor active container viewport clipping and
  scroll offsets.
- Query results expose every hit branch front-to-back so consumers can discard
  renderer occurrences without selection owners and continue behind them.
- Hit testing does not change event binding or dispatch. Authored hover, click,
  drag, keyboard, input, slider, and scroll behavior remains active.
- Final validation passes all 88 test files and 686 tests.

# Downstream Integration

RouteVN Creator will consume this API in a follow-up interactive-editing
change. It remains responsible for occurrence-to-authored-item ownership,
hierarchy selection, hover/click/double-click observation, explorer
synchronization, and exclusive editor move/resize gestures. Authored preview
interactions continue running in the layout editor.
