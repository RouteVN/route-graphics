# Particles Implementation Plan

Last updated: 2026-04-06

## Goal

Replace the current public particle authoring surface with a structured, editor-friendly module model while keeping the existing emitter runtime as the execution engine.

The main product goal is:

- users and the future UI editor author particles through high-level `modules`
- Route Graphics compiles those modules into the current low-level `texture + behaviors + emitter` runtime shape
- the public contract becomes easier to validate, easier to document, and easier to evolve

This plan intentionally does not add a public raw escape hatch in this phase.

## End State

The target public `particles` element shape is:

```yaml
elements:
  - id: snow
    type: particles
    x: 0
    y: 0
    width: 1280
    height: 720
    alpha: 1
    seed: 12345

    modules:
      emission:
        mode: continuous
        rate: 40
        maxActive: 180
        duration: infinite
        particleLifetime:
          min: 4
          max: 8
        source:
          kind: rect
          data:
            x: 0
            y: -20
            width: 1280
            height: 10

      movement:
        velocity:
          kind: directional
          direction: 90
          speed:
            min: 50
            max: 150
        acceleration:
          x: 0
          y: 0
        maxSpeed: 0
        faceVelocity: false

      appearance:
        texture:
          mode: single # single | random | cycle
          pick: perParticle # perParticle | perWave
          items:
            - src: snowflake
        scale:
          mode: range
          min: 0.3
          max: 1
        alpha:
          mode: curve
          keys:
            - { time: 0, value: 0 }
            - { time: 0.1, value: 0.8 }
            - { time: 0.8, value: 0.8 }
            - { time: 1, value: 0 }
        color:
          mode: single
          value: "#ffffff"
        rotation:
          mode: spin
          start:
            min: 0
            max: 360
          speed:
            min: -45
            max: 45

      bounds:
        mode: recycle
        source: area
        padding:
          top: 50
          right: 50
          bottom: 50
          left: 50
```

Product rules:

- `modules` is the only documented public particle authoring interface
- one `particles` element represents one emitter
- multi-part effects are composed with multiple `particles` elements, typically inside a `container`
- `snow`, `rain`, `fire`, `smoke`, and similar names are presets/templates in the editor, not public schema types
- `appearance.texture` supports one or more texture items with explicit selection behavior
- deterministic randomness is exposed through top-level `seed`
- the existing runtime emitter and behavior engine remains the execution layer behind the scenes

## Where We Are Now

Current public particle input is already the low-level engine surface:

- top-level `texture`
- top-level `behaviors[]`
- top-level `emitter`
- legacy shorthand `count`

Current issues:

- the public API exposes runtime concepts directly instead of editor concepts
- behavior ordering and overlap are hard to reason about in a UI
- validation is too weak for behavior-specific configs
- current docs and runtime config shape are already inconsistent in places
- width, height, spawn areas, and recycle bounds are manually coupled in examples
- update behavior recreates the emitter for most config changes, which is acceptable internally but awkward for direct low-level editing

Primary files involved today:

- `src/plugins/elements/particles/parseParticles.js`
- `src/plugins/elements/particles/util/validateParticles.js`
- `src/plugins/elements/particles/addParticles.js`
- `src/plugins/elements/particles/updateParticles.js`
- `src/plugins/elements/particles/emitter/emitter.js`
- `src/plugins/elements/particles/behaviors/*.js`
- `src/schemas/elements/particle.element.yaml`
- `src/schemas/elements/particle.computed.yaml`
- `src/types.js`
- `playground/pages/docs/nodes/particles.md`

## Target Public Model

The public model is organized into four particle modules:

- `emission`
- `movement`
- `appearance`
- `bounds`

### Emission

Owns when particles are created and how many can exist:

- emission mode such as continuous or burst
- spawn rate or burst count
- max active particles
- emitter duration
- particle lifetime range
- emission source shape

`emission.source` owns where particles are born:

- point
- rect
- circle
- line
- burst origin and angular setup if needed

Structured source rule:

- `emission.source` uses `kind` plus a `data` payload
- the public shape does not flatten all shape-specific fields into one shared object
- this keeps rect, circle, line, point, and future shapes extensible without polluting the top-level module surface

### Movement

Owns how particles travel after spawn:

- initial velocity
- radial or directional launch
- acceleration
- gravity-like motion
- speed limits
- optional velocity-facing rotation

The important rules are:

- `movement` is the only public module that controls trajectory
- `movement` is composable, not a single exclusive enum
- a particle may have an initial velocity and an ongoing acceleration at the same time

### Appearance

Owns how particles look:

- texture
- multi-texture selection when only the visual sprite differs
- scale
- alpha
- color
- rotation

The important rule is that `appearance` is the only public module that controls visual channels.

Texture rule:

- one particle element may use multiple textures for visual diversity
- if the only difference is sprite choice, keep that inside `appearance.texture`
- if different particle families need different movement, lifetime, or emission, use separate `particles` elements
- texture selection must support `single`, `random`, and `cycle`
- texture selection must support `pick: perParticle | perWave`
- texture items may reference either an asset alias or an inline shape texture

### Bounds

Owns what happens when particles leave the allowed region:

- no bounds policy
- recycle outside bounds
- bounds derived from the element area
- optional padding around the area
- explicit custom bounds if needed later

Bounds rule:

- `padding` should accept either one number or per-side values

### Seed

Structured particles should expose deterministic randomness directly:

- top-level `seed` is part of the structured public contract
- the compiler maps it into the current emitter RNG path
- any randomness-driven module behavior must respect this seed so previews and VT remain stable

## Internal Execution Model

The runtime should continue executing the current computed shape:

- `texture`
- `behaviors[]`
- `emitter`

This means the structured module model is compiled into the existing internal form during parsing.

That keeps:

- `addParticles.js`
- `updateParticles.js`
- `Emitter`
- existing behavior implementations

largely unchanged during the first migration, with one deliberate extension for texture selection inside a single emitter.

## Design Rules

- the public particle model is module-driven, not behavior-driven
- each public module owns one concern
- public modules must not compete over the same property surface
- the compiler may emit one or more low-level behaviors for a given module
- the public model should prefer semantic names over engine names
- the public model should expose defaults and derived values where possible instead of manual bookkeeping

## Mapping From Modules To Runtime

The initial module-to-runtime mapping should be:

- top-level `seed` -> `emitter.seed`
- `modules.emission` -> `emitter.lifetime`, `emitter.frequency`, `emitter.particlesPerWave`, `emitter.maxParticles`, `emitter.emitterLifetime`
- `modules.emission.source` -> `spawnShape` or `spawnBurst`
- `modules.movement` -> one or more movement-related compiled fields or behaviors, with preference for one combined runtime behavior when the requested motion maps cleanly to existing capabilities
- `modules.appearance.texture` -> top-level `texture` for single-texture cases, or a compiled texture selector for multi-texture cases
- `modules.appearance.scale` -> `scale` or `scaleStatic`
- `modules.appearance.alpha` -> `alpha` or `alphaStatic`
- `modules.appearance.color` -> `color` or `colorStatic`
- `modules.appearance.rotation` -> `rotation`, `rotationStatic`, or `noRotation`
- `modules.bounds` -> `emitter.spawnBounds` and `emitter.recycleOnBounds`

Compiler rules:

- a structured particle element should compile into a normal current-style computed node before mounting
- compiled output should be deterministic for a given structured input
- derived values such as bounds from `source: area` should be resolved in the compiler, not in the editor
- texture selection must respect seeded randomness so visual tests remain deterministic
- movement compilation should prefer one coherent motion plan instead of emitting overlapping low-level behaviors that fight each other

## Scope For The First Structured Release

The first structured release should cover:

- snow
- rain
- burst
- sparkle
- smoke
- fire

That means v1 must support enough module options to express:

- continuous and burst emission
- rect, point, line, and circle emission sources
- directional or radial initial velocity
- acceleration-based motion
- velocity plus acceleration together
- optional face-velocity rotation
- single textures
- weighted random or cyclic texture selection inside one emitter
- per-particle and per-wave texture picking
- range and curve controls for alpha and scale
- static and gradient color
- fixed, random, and spin rotation
- recycle bounds derived from the element area with padding
- deterministic seeded output for all randomness-driven choices

## Deferred For Later

These are explicitly out of scope for this phase:

- a public raw escape hatch
- multi-layer particle effects inside one `particles` element
- cross-emitter dependencies
- plugin-defined custom particle modules
- arbitrary user-authored behavior ordering
- advanced movement fields like turbulence, orbit, attraction, or collisions

If these become necessary, they should be added later without weakening the structured default model.

## Migration Strategy

## Step 1: Freeze The Public Module Vocabulary

Goal:

- lock the top-level particle module structure before implementation work spreads

Work:

- confirm the four public modules:
  - `emission`
  - `movement`
  - `appearance`
  - `bounds`
- confirm `emission.source` as the only public spawn/sourcing surface
- confirm the nested `appearance` sub-surfaces:
  - `texture`
  - `scale`
  - `alpha`
  - `color`
  - `rotation`
- remove `layers` from the structured design
- do not introduce `mode`, `model`, `effect`, or other wrapper discriminators

## Step 2: Introduce Structured Types And Schema

Goal:

- make the structured particle shape an official parser target

Work:

- update `src/schemas/elements/particle.element.yaml` to accept `modules`
- update `src/schemas/elements/particle.computed.yaml` to describe the compiled computed form
- add structured particle typedefs to `src/types.js`
- define structured subtypes for:
  - emission
  - movement
  - appearance
  - bounds
- define structured `emission.source` subtypes
- define the structured top-level `seed`
- ensure top-level `texture`, `behaviors`, `emitter`, and `count` are no longer part of the documented structured input

Compatibility rule during migration:

- the parser may continue accepting the current raw shape temporarily for backward compatibility
- that compatibility path is not the new public contract

## Step 3: Build A Module Compiler

Goal:

- translate the public structured shape into the current runtime shape

Work:

- add a dedicated compiler module, likely under `src/plugins/elements/particles/`
- compile `modules` into:
  - `texture`
  - `behaviors[]`
  - `emitter`
- centralize all derived defaults in this compiler
- centralize all area-derived bounds logic in this compiler
- normalize `appearance.texture` into a single compiled texture selector shape, even when the public input uses a shorthand single texture
- normalize single-number and per-side bounds padding into one internal bounds form
- compile composable movement into the minimal internal motion representation that preserves intent

Recommended new files:

- `src/plugins/elements/particles/compileParticleModules.js`
- `src/plugins/elements/particles/util/validateParticleModules.js`

The parser flow should become:

1. validate the structured public shape
2. compile `modules` into current internal fields
3. return the same computed shape the runtime already knows how to mount

## Step 4: Add Texture Selector Runtime Support

Goal:

- support multiple texture choices inside one emitter without introducing particle layers

Work:

- extend the internal particle texture representation so a compiled particle node can carry either:
  - one resolved texture input
  - or a texture selector with selection mode and items
- support at least:
  - `single`
  - `random`
  - `cycle`
- support item weights for random selection
- make seeded randomness drive texture selection when a seed is present
- assign chosen textures per particle spawn, or per wave if that becomes part of the module contract

Likely runtime files touched:

- `src/plugins/elements/particles/addParticles.js`
- `src/plugins/elements/particles/emitter/emitter.js`
- `src/plugins/elements/particles/emitter/particle.js`
- `src/types.js`
- particle schema files

## Step 5: Tighten Validation

Goal:

- make particle input safe for UI authoring

Work:

- validate module-specific required fields instead of only top-level object existence
- reject conflicting structured fields
- reject mixed structured and raw authoring on the same element
- validate curve keyframes:
  - times must be numbers
  - times must be in ascending order after normalization
  - times must be within `[0, 1]`
- validate ranges such as min/max and direction-bearing configs
- validate bounds policies and derived area rules
- validate structured seed type and determinism-related assumptions

Additional cleanup:

- remove `count` from the structured surface
- stop documenting any field that exists only for legacy raw compatibility

Additional texture validation:

- validate that `appearance.texture.items` is non-empty
- validate that random-mode weights are positive
- validate that cycle-mode items are ordered and deterministic
- validate that texture items resolve to supported texture sources
- validate `pick: perParticle | perWave`

Additional movement validation:

- validate allowed combinations such as:
  - velocity only
  - acceleration only
  - velocity plus acceleration
- reject movement combinations that compile into conflicting runtime plans
- validate direction-bearing configs and speed ranges

Additional shape and bounds validation:

- validate `emission.source.kind + data` pairs instead of one flattened payload
- validate bounds padding as either:
  - one number
  - or an object with top/right/bottom/left numbers

## Step 6: Keep Runtime Mounting Stable

Goal:

- minimize runtime churn while changing the public API

Work:

- keep `addParticles.js` consuming the existing computed runtime shape
- keep `updateParticles.js` recreation behavior unchanged in the first pass
- keep behavior classes unchanged
- keep emitter lifecycle logic unchanged except for the targeted texture selector support added earlier

This phase is deliberately about API cutover, not engine redesign.

## Step 7: Migrate Docs, Examples, And Playground

Goal:

- make the structured model the visible Route Graphics contract

Work:

- rewrite `playground/pages/docs/nodes/particles.md` around `modules`
- update `src/plugins/elements/particles/docs/README.md`
- migrate examples:
  - snow
  - rain
  - fire
  - burst
- remove raw behavior-first examples from the main docs
- fix current doc/runtime mismatches while doing this migration

Important documentation rule:

- presets such as snow and fire should be presented as examples built with modules, not as dedicated schema types

## Step 8: Add Parser And Visual Tests For Structured Particles

Goal:

- prove that the structured surface compiles correctly and preserves visual behavior

Work:

- add parser tests for structured inputs in `spec/parser/parseParticles.test.yaml`
- update or add VT fixtures that use the structured model
- ensure the migrated snow/rain/sparkle/burst fixtures still render deterministically with seeded randomness

Minimum coverage:

- a continuous weather effect
- a burst effect
- a fire or smoke effect driven by acceleration
- a movement case that combines initial velocity with acceleration
- a bounds-derived recycle example
- a multi-texture random or cycle example with deterministic seeded output

## Step 9: Add UI Metadata For The Editor

Goal:

- make the particle model directly editable by the future UI editor

Work:

- define editor metadata for each module and sub-surface
- provide labels, enums, defaults, ranges, and conditional field visibility
- keep that metadata aligned with parser validation and compiler defaults

This metadata layer should describe the structured module surface, not the low-level runtime behavior list.

## Step 10: Deprecate The Legacy Raw Public Shape

Goal:

- complete the public contract cutover after structured particles are in use

Work:

- decide whether legacy raw input remains accepted silently, accepted with warnings, or removed entirely
- remove legacy-focused docs once structured particles are fully adopted
- keep internal compiler and runtime execution centered on the structured contract

This deprecation should happen only after the editor and examples are using the structured model successfully.

## Acceptance Criteria

The migration is complete when:

- the documented particle API is `modules`-based
- snow, rain, sparkle, burst, smoke, and fire are expressible through structured modules
- one particle element can express visual multi-texture variation without splitting into multiple particle elements
- movement can express both initial velocity and ongoing acceleration in one structured model
- the runtime still mounts through the existing emitter/behavior engine
- editor form generation can target the structured module model directly
- docs, examples, parser tests, and visual tests all use the structured particle model as the primary path

## Files Likely Touched

- `src/plugins/elements/particles/parseParticles.js`
- `src/plugins/elements/particles/util/validateParticles.js`
- `src/plugins/elements/particles/addParticles.js`
- `src/plugins/elements/particles/updateParticles.js`
- `src/schemas/elements/particle.element.yaml`
- `src/schemas/elements/particle.computed.yaml`
- `src/types.js`
- `playground/pages/docs/nodes/particles.md`
- `src/plugins/elements/particles/docs/README.md`
- `src/plugins/elements/particles/docs/examples/*.yaml`
- `spec/parser/parseParticles.test.yaml`
- `vt/specs/particles/*.yaml`

## Recommended Order Of Execution

1. Freeze the public module vocabulary and nested field names.
2. Add structured schema and type definitions.
3. Build the module compiler and structured validation.
4. Keep runtime mounting stable by compiling into the current computed shape.
5. Migrate docs, examples, parser tests, and visual tests.
6. Add editor metadata for the structured modules.
7. Only then decide how aggressively to deprecate the legacy raw public shape.
