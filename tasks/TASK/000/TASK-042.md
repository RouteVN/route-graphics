---
title: add design-surface bounds hit testing
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
- [x] Define scroll viewport clipping, zero-opacity participation, and editor-chrome exclusion.
- [x] Implement and expose `hitTestElementBounds()` on the Route Graphics instance.
- [x] Add design interaction mode so authored pointer, keyboard, input, slider, and scroll behavior is inert.
- [x] Preserve explicitly marked design-tool interactions for editor-owned chrome.
- [x] Add focused regression coverage and public documentation.
- [x] Prepare feature version `1.29.0`.

# Outcome

- Bounds queries use live Pixi transforms, preserve rotated corners, include
  transparent layout bounds, and honor active container viewport clipping and
  scroll offsets.
- Query results expose every hit branch front-to-back so consumers can discard
  renderer occurrences without selection owners and continue behind them.
- `interactionMode: "design"` suppresses authored pointer, keyboard, input,
  slider, and scroll behavior. `designInteraction: true` restores interaction
  for editor-owned chrome while excluding that chrome from hit-test results.
- Final pre-push validation passed all 88 Route Graphics test files and all 692
  tests, after source formatting completed successfully.

# Downstream Integration

RouteVN Creator will consume this API in a follow-up change. It remains
responsible for occurrence-to-authored-item ownership, hierarchy selection,
hover/click/double-click gestures, explorer synchronization, and editor chrome.
