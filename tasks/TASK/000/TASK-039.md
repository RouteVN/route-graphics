---
title: review particles interface
status: todo
priority: high
assignee: JeffY
---

# Description

- do a presentation for the team for current interface
- need to balance easy to use with presets, and very customizability
- check with AI, use it with [ultrathink](https://discord.com/channels/1388082134748500139/1388082136627548222/1422431597839388753) to come up with some alternative better interfaces
- think of some real VN with particle effects
- think how user will be able to edit those from UI
- list down the limitations, so we check those limitations are acceptable
- present and discuss this with team to get feedback

---

# Current Interface: Preset + Behavior Composition

## Simple Usage (Presets)

```yaml
# Snow effect - just works
- type: particles
  preset: snow

# Available: snow, rain, fire, burst
```

## Intermediate (Customize Presets)

```yaml
# Modify preset defaults
- type: particles
  preset: snow
  count: 500                    # More particles
  disableBehaviors: [rotation]  # Remove spinning
  emitter:
    frequency: 0.02             # Spawn faster
```

## Advanced (Custom Behaviors)

```yaml
# Build from scratch - requires understanding 15+ behavior types
- type: particles
  texture: { shape: circle, radius: 2 }
  behaviors:
    - type: spawnShape          # Where to spawn
      config: { type: rect, data: {...} }
    - type: alpha               # Fade in/out
      config:
        list:
          - { value: 0, time: 0 }
          - { value: 1, time: 0.5 }
          - { value: 0, time: 1 }
    - type: movePoint           # Movement
      config: { speed: {...}, direction: 90 }
  emitter:
    lifetime: { min: 0.5, max: 1.5 }
    frequency: 0.1
```

## Behavior Types (15 total)

**Appearance:** alpha, alphaStatic, color, colorStatic, scale, scaleStatic
**Movement:** movePoint, speed, speedStatic, acceleration, gravity
**Rotation:** rotation, rotationStatic, noRotation
**Spawn:** spawnShape, spawnBurst

---

# Alternative Interface Designs

## Option A: Natural Language Parameters

Expand presets with intuitive parameters instead of behaviors:

```yaml
# Current (requires understanding behaviors)
- type: particles
  preset: snow
  disableBehaviors: [rotation]

# Alternative A (natural language)
- type: particles
  preset: snow
  amount: heavy        # light/medium/heavy → maps to count
  speed: slow          # slow/medium/fast → maps to movement
  drift: gentle        # none/gentle/strong → lateral movement
  fade: in-out         # none/in/out/in-out/pulse → alpha behavior
  spin: false          # true/false → rotation behavior
```

**Pros:** Intuitive, no technical knowledge needed, maps cleanly to GUI sliders

**Cons:** Less flexible, requires many presets to cover use cases

## Option B: Simplified + Advanced Modes

Keep current system but add shortcuts:

```yaml
# Simple mode
- type: particles
  preset: snow
  simple:
    amount: heavy
    speed: slow
    opacity: 0.8

# Advanced mode (escape hatch)
- type: particles
  preset: snow
  advanced:
    behaviors:
      - type: alpha
        config: { ... }
    emitter: { ... }
```

**Pros:** Smooth learning curve, backwards compatible

**Cons:** Two ways to do everything, maintenance burden

## Option C: Wizard/Grouped Structure

Organize by concept instead of behavior composition:

```yaml
- type: particles

  appearance:
    texture: circle
    size: { min: 2, max: 5 }
    color:
      from: "#ffffff"
      to: "#ffff00"

  lifecycle:
    spawn:
      every: 0.05s
      amount: 2
    lifetime: { min: 1s, max: 3s }

  movement:
    area: { type: rect, x: 0, y: 0, w: 1280, h: 10 }
    direction: down
    speed: { min: 100, max: 200 }

  effects:
    fade: { in: 20%, out: 80% }
    spin: random
```

**Pros:** Self-documenting, grouped by concept

**Cons:** More verbose, requires schema redesign

## Option D: More Presets + Keep Current

Add 15+ presets to cover common cases, keep advanced system:

```yaml
# New presets cover 95% of use cases
- type: particles
  preset: sparkle     # ✨ Twinkling stars

- type: particles
  preset: petals      # 🌸 Floating cherry blossoms

- type: particles
  preset: fog         # 🌫️ Slow horizontal drift

- type: particles
  preset: fireflies   # 🪲 Glowing particles

# Advanced users still get full control
- type: particles
  behaviors: [...]
```

**Pros:** Minimal change, backwards compatible, solves 95% use case

**Cons:** Preset explosion, still need behaviors for edge cases

---

# Comparison

| Aspect | Current | Option A (Natural) | Option B (Hybrid) | Option C (Wizard) | Option D (More Presets) |
|--------|---------|-------------------|-------------------|-------------------|------------------------|
| **Learning Curve** | Medium | Low | Low→Medium | Medium | Low |
| **Flexibility** | High | Medium | High | High | High |
| **For Non-Coders** | 6/10 | 9/10 | 8/10 | 7/10 | 9/10 |
| **For Power Users** | 9/10 | 6/10 | 9/10 | 8/10 | 9/10 |
| **Backend Changes** | - | Medium | Medium | High | Low |
| **GUI Complexity** | Medium | Low | Medium | Medium | Low |
| **Backwards Compatible** | - | ❌ | ✅ | ❌ | ✅ |
| **Documentation Burden** | Medium | Low | High (two modes) | Medium | Medium |

---

# Recommended Approach

**Hybrid: Option D + Backend Introspection**

1. Keep current interface (it's well-designed)
2. Add 12 new presets: sparkle, petals, fog, fireflies, bubbles, leaves, dust, embers, stars, confetti, smoke, glitter
3. Add schema export API for route-engine/GUI
4. Add natural language shortcuts as syntactic sugar (optional):
   ```yaml
   preset: snow
   amount: heavy  # → count: 500
   speed: slow    # → emitter.frequency adjustment
   ```

**Why:**
- Solves 95% of VN use cases with presets
- Maintains power for advanced users
- Backwards compatible
- Minimal backend changes
- route-engine can build smart UIs with schema API

**Implementation:**
- Week 1: Schema export API
- Week 2: 12 new presets
- Week 3: Natural language shortcuts (optional)
- Week 4: Documentation + examples

**Architecture Note:**
```
User clicks "Add Sparkles" in routevn-creator-client
  ↓
route-engine queries getAvailablePresets() → sees "sparkle"
  ↓
route-engine generates: { type: "particles", preset: "sparkle" }
  ↓
route-graphics renders sparkles
```

# Demo

This is demo for particle emitter, where we borrowed many code from. They have a demo that can be referred.

https://particle-emitter-editor.pixijs.io/#pixieDust

# Decision

- Try to use values instead of names like "heavy". Use number from 0 to 1 for percentage where possible and exact numbers otherwise (e.g. count: 300)
- Leave abstraction (preset) for client side to deal with, route-graphics just take whatever it gets and then render without caring about preset.
- Decide later what options to expose in client side, choose the most important ones that users may use more often. We manage internally those values that are not exposed. JeffY will test whether some options are needed and whether to expose from client side.