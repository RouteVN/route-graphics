# VT Guidelines

Last updated: 2026-02-10

## Purpose

Define one stable standard for VT authoring:

- Minimal visual language for consistent screenshots.
- Deterministic behavior testing without flaky text-on-screen assertions.

## Core Principles

- Keep snapshots simple and high-contrast.
- Prefer deterministic state changes over decorative visuals.
- Use VT for rendering correctness.
- Use unit/integration tests for non-visual behavior correctness.

## Visual Standard

### Default Look

- Use black background by default.
- Use white as default foreground color for rects/simple shapes.
- When differentiation is needed, use grayscale only.
- Do not use random or saturated colors unless color itself is the subject of the test.

### Approved Palette

- `bg`: `#000000`
- `fg-100`: `#FFFFFF`
- `fg-80`: `#D9D9D9`
- `fg-60`: `#A6A6A6`
- `fg-45`: `#737373`
- `fg-30`: `#4D4D4D`

### Visual Rules

- Keep each snapshot black + white whenever possible.
- Use grayscale only for overlap/layer distinction.
- Use the minimum number of shades needed to separate elements.
- Keep shade semantics consistent within a spec family.
- Avoid gradients, glow, and decorative styling in VT.

### Allowed Exceptions

- Tests explicitly validating color behavior.
- Text plugin tests validating `textStyle.fill`.
- Asset-based tests where source textures are inherently colored.

If using an exception, mention why in the spec `description`.

### Visual Anti-Patterns

- Random color per element.
- Rainbow palettes for non-color behavior tests.
- Relying on color-only change when geometry/alpha/z-order could assert behavior.

## Behavior Testing Standard

### Hard Rule

- Do not use on-screen debug text as behavior oracle.
- Do not assert callback/event correctness by snapshotting rendered event logs.

### Preferred Assertion Order

1. Assert via deterministic visual outcomes in VT:
   - geometry (`x`, `y`, `width`, `height`)
   - visibility (`alpha`)
   - layering (`zIndex`)
   - source/state changes (`src`, texture swap, presence/absence)
2. If behavior is not visually observable, assert outside VT:
   - unit/integration tests for callback payloads, audio/video runtime behavior

### Immediate Rules for Existing Specs

- Replace event-log text overlays with deterministic element-state changes.
- Avoid long `wait`-based flows when `customEvent snapShotKeyFrame` can drive deterministic timing.
- Avoid dynamic snapshot content (timestamps, runtime-generated IDs, arbitrary debug strings).
- If a behavior cannot be asserted visually, move assertion to `vitest`.

### Deferred: Runtime Event Assertions

- Runtime assertions via `customEvent` are deferred until VT runner support is finalized.
- Current migration must not depend on new assertion APIs.
- For now:
  - keep VT assertions visual-only,
  - move non-visual event payload checks to unit/integration tests.

### Migration Pattern

Old pattern:

- Trigger event.
- Render event payload text to canvas.
- Compare screenshot containing dynamic text.

New pattern:

- Trigger event.
- Verify deterministic visual state in VT.
- Verify payload correctness in non-VT tests.

## Authoring Checklist

- Spec uses default black/white/grayscale palette unless exception is documented.
- No random colors.
- No text-log-based behavior assertion.
- Every event spec includes at least one explicit interaction step.
- Multi-state specs advance across intended states with explicit steps.
- Screenshot sequence matches intended checkpoints only (no redundant frames).

## Examples

### Preferred Visual Structure

```yaml
states:
  - elements:
      - id: "base"
        type: "rect"
        x: 120
        y: 120
        width: 300
        height: 180
        fill: "#FFFFFF"
      - id: "overlay"
        type: "rect"
        x: 180
        y: 160
        width: 300
        height: 180
        fill: "#A6A6A6"
```

### Behavior Test Direction (No Text Log)

- Trigger `hover`/`click`.
- Assert deterministic `src` or `alpha` change in snapshot.
- Assert payload in unit/integration test.

### Visual-Only Event Step Example

```yaml
steps:
  - move 200 120
  - click 200 120
  - screenshot
```
