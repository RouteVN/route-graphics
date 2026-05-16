# Shader Interface

Last updated: 2026-05-16

## Status

This document defines the v1 shader interface implemented by the runtime.

The current runtime supports element shader `filters`, transition shader
`compositor`, WebGL/WebGPU inline source validation, and `uProgress` tweening
through the existing animation model.

## Goals

- support custom shader filters on elements and containers
- support custom shader compositors for transitions
- support WebGL and WebGPU from the first implementation
- keep shader timing inside the existing animation model
- keep shader code inline for v1
- keep the first implementation small enough to validate

## Non-Goals For V1

- registered named shaders
- shader source file references
- arbitrary uniform tweening
- `uTime` as a built-in clock uniform
- multiple transition compositors in one transition
- combining `mask` and `compositor` in one transition

These can be added later without changing the core concepts below.

## Concepts

### Element Filter

An element filter is a post-processing pass on one rendered element or
container surface.

```txt
uTexture -> shader filter -> output
```

Element filters live on the element:

```yaml
elements:
  - id: scene-root
    type: container
    width: 1280
    height: 720
    filters:
      - id: crt
        type: shader
        uniforms:
          intensity: 0.3
        source:
          webgl:
            fragment: |
              // GLSL fragment source.
          webgpu:
            source: |
              // WGSL source with mainVertex and mainFragment.
```

Multiple filters are allowed. They run in array order:

```txt
element output -> filter A -> filter B -> filter C -> final output
```

Filter ordering relative to built-in element effects:

```txt
element's own rendering
-> built-in managed filters, in managed order
-> element filters[], in array order
```

Text shadows that are part of text rendering are baked into the element before
element filters run. Managed Pixi filters keep their fixed internal order, such
as `shadow` before `blur`; shader filters run after those built-in managed
filters in v1.

### Transition Compositor

A transition compositor is a transition-specific shader pass that receives the
previous and next rendered surfaces.

```txt
uTexture + uNextTexture + uProgress -> shader compositor -> output
```

For transition compositors, `uTexture` is the previous rendered surface and
`uNextTexture` is the next rendered surface. This matches the Pixi filter ABI
used by the current mask transition runtime.

Transition compositors live on `type: transition` animations:

```yaml
animations:
  - id: page-turn
    targetId: scene-root
    type: transition
    tween:
      uProgress:
        initialValue: 0
        keyframes:
          - duration: 800
            value: 1
            easing: easeInOutCubic
    compositor:
      type: shader
      uniforms:
        radius: 0.35
      source:
        webgl:
          vertex: |
            // GLSL vertex source.
          fragment: |
            // GLSL fragment source.
        webgpu:
          source: |
            // WGSL source with mainVertex and mainFragment.
```

V1 supports one compositor per transition. If the transition needs additional
visual processing, put persistent filters on the target element/container.

A compositor counts as a transition handoff primitive. A transition animation
may therefore define `compositor` without also defining `prev`, `next`, or
`mask`.

When `compositor` is present, `tween.uProgress` is required. The compositor
never receives an implicit `0 -> 1` timeline. Authors must define the timing
explicitly so shader transitions remain deterministic and render-complete
tracking has a concrete duration.

`compositor` and `mask` are mutually exclusive in v1. If an effect needs both,
the mask logic should be implemented inside the compositor shader, or the
transition should use the existing `mask` path without a compositor.

## Timing Model

Shaders do not contain keyframes.

Animations own timelines. Shaders expose inputs.

For v1, `uProgress` is the only dynamic shader input.

```txt
uProgress:
  type: float
  unit: none
  default: 0
  transition convention: 0 = previous visual, 1 = next visual
  filter convention: shader-defined control value
```

`uProgress` is a normal tween property:

```yaml
animations:
  - id: glitch-burst
    targetId: scene-root
    type: update
    tween:
      uProgress:
        initialValue: 0
        keyframes:
          - duration: 80
            value: 1
            easing: linear
          - duration: 120
            value: 0
            easing: linear
```

For `type: update`, `uProgress` drives shader filters on the target element.
If the element has multiple shader filters, all of them receive the same
`uProgress` value in v1.

If the target element has no shader filters, `uProgress` has no visible effect.

For `type: transition`, `uProgress` drives the transition compositor.
This is a narrow extension to the transition animation shape:

- `transition.tween` is valid only when `compositor` is present
- when present on a transition, `tween` may contain only `uProgress`
- `prev.tween` and `next.tween` remain the only transition surface motion
  controls
- top-level transition tweens for `x`, `y`, `alpha`, `scaleX`, and similar
  properties remain invalid

Transition compositor execution order:

1. sample `tween.uProgress` for the current animation time
2. sample `prev.tween` and `next.tween`, if present, for the same animation time
3. render the previous surface with `prev.tween` applied
4. render the next surface with `next.tween` applied
5. bind the previous surface as `uTexture`
6. bind the next surface as `uNextTexture`
7. run the compositor shader

The compositor sees side motion already baked into `uTexture` and
`uNextTexture`.

`uProgress` lifecycle rules:

- the base value is `0`
- an active `uProgress` tween writes the sampled value each animation tick
- when the tween completes, the last sampled value remains until another render
  or animation changes it
- a later render with no active `uProgress` tween resets the target filter
  progress to `0`
- multiple active `uProgress` animations for the same `targetId` in one render
  are invalid
- persistent playback follows the existing animation continuity rules by stable
  animation `id` and unchanged normalized config

No arbitrary uniform tweening is supported in v1. This is intentionally not
valid:

```yaml
animations:
  - id: invalid
    targetId: scene-root
    type: update
    tween:
      uniforms.intensity:
        keyframes:
          - duration: 100
            value: 1
```

## Element Filter Shape

```yaml
elements:
  - id: scene-root
    type: container
    width: 1280
    height: 720
    filters:
      - id: crt
        type: shader

        uniforms:
          intensity: 0.3
          curvature: 0.05

        textures:
          noise: "textures/noise.png"

        pipeline:
          blend: normal
          textureWrap: clamp
          mipmap: false

        source:
          webgl:
            vertex: |
              // Optional for simple filters.
              // If omitted, Route Graphics uses a default pass-through vertex shader.
            fragment: |
              // Required GLSL fragment shader.

          webgpu:
            source: |
              // Required WGSL source.
              // Must define:
              //   @vertex fn mainVertex(...)
              //   @fragment fn mainFragment(...)
```

Fields:

- `id`: required filter id, unique within the element's filter list
- `type`: required, must be `shader`
- `uniforms`: optional static shader parameters
- `textures`: optional named texture inputs
- `pipeline`: optional draw and sampling options
- `source`: required inline shader source for both WebGL and WebGPU

Element filters use a single full-target quad in v1. Custom element-filter mesh
subdivision is deferred until there is a concrete use case.

## Transition Compositor Shape

```yaml
animations:
  - id: page-turn
    targetId: scene-root
    type: transition

    tween:
      uProgress:
        initialValue: 0
        keyframes:
          - duration: 800
            value: 1
            easing: easeInOutCubic

    compositor:
      type: shader

      uniforms:
        radius: 0.35
        shadowStrength: 0.6

      textures:
        paper: "textures/paper.png"

      mesh:
        grid: [64, 2]

      pipeline:
        blend: normal
        textureWrap: clamp
        mipmap: false

      source:
        webgl:
          vertex: |
            // GLSL vertex shader.
          fragment: |
            // GLSL fragment shader.

        webgpu:
          source: |
            // WGSL source with mainVertex and mainFragment.
```

Fields:

- `compositor`: valid only on `type: transition`
- `compositor.type`: required, must be `shader`
- `uniforms`: optional static shader parameters
- `textures`: optional named texture inputs
- `mesh`: optional mesh configuration, defaults to one quad
- `pipeline`: optional draw and sampling options
- `source`: required inline shader source for both WebGL and WebGPU

## Source

V1 supports inline source only.

```yaml
source:
  webgl:
    vertex: |
      // Optional GLSL vertex shader.
    fragment: |
      // Required GLSL fragment shader.
  webgpu:
    source: |
      // Required WGSL source.
```

Both `webgl` and `webgpu` are required when `source` is present.

This is intentional: Route Graphics may run with either renderer backend, so a
scene file that validates should not depend on which backend is active. Built-in
starter scaffolds are documented below to keep the authoring burden predictable.

WebGPU entry point names are standardized. Public config does not expose entry
point names.

WGSL source must define:

```wgsl
@vertex
fn mainVertex(...) -> VSOutput {
  // ...
}

@fragment
fn mainFragment(...) -> @location(0) vec4<f32> {
  // ...
}
```

For simple WebGL filter shaders and non-deforming transition compositors,
`webgl.vertex` may be omitted. Route Graphics will provide a default
pass-through vertex shader.

For mesh deformation, such as page curl, `webgl.vertex` should be provided.

### WebGL Filter Scaffold

If `source.webgl.vertex` is omitted, Route Graphics provides this default
pass-through vertex shader:

```glsl
in vec2 aPosition;

out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void)
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;

    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;

    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void)
{
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void)
{
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
```

WebGL fragment shaders should use this interface:

```glsl
precision mediump float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uProgress;
uniform vec2 uResolution;

void main(void)
{
    vec4 color = texture(uTexture, vTextureCoord);
    finalColor = color;
}
```

For transition compositor fragments, `uTexture` is the previous surface and
`uNextTexture` is the next surface:

```glsl
precision mediump float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uNextTexture;
uniform float uProgress;
uniform vec2 uResolution;

void main(void)
{
    vec4 prevColor = texture(uTexture, vTextureCoord);
    vec4 nextColor = texture(uNextTexture, vTextureCoord);
    finalColor = mix(prevColor, nextColor, uProgress);
}
```

WebGL source uses Pixi v8 filter GLSL syntax with `in` / `out` varyings.
Custom WebGL vertex shaders must accept `in vec2 aPosition`, write
`gl_Position`, and output any varyings consumed by the fragment shader.

### WebGPU Filter Scaffold

WGSL source must use this group layout for filter shaders:

```wgsl
struct GlobalFilterUniforms {
  uInputSize: vec4<f32>,
  uInputPixel: vec4<f32>,
  uInputClamp: vec4<f32>,
  uOutputFrame: vec4<f32>,
  uGlobalFrame: vec4<f32>,
  uOutputTexture: vec4<f32>,
};

struct ShaderUniforms {
  uProgress: f32,
  uResolution: vec2<f32>,
  // custom uniforms follow
};

@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> shaderUniforms: ShaderUniforms;

struct VSOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

fn filterVertexPosition(aPosition: vec2<f32>) -> vec4<f32>
{
  var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;

  position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;

  return vec4(position, 0.0, 1.0);
}

fn filterTextureCoord(aPosition: vec2<f32>) -> vec2<f32>
{
  return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);
}

@vertex
fn mainVertex(@location(0) aPosition: vec2<f32>) -> VSOutput
{
  return VSOutput(
    filterVertexPosition(aPosition),
    filterTextureCoord(aPosition),
  );
}

@fragment
fn mainFragment(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32>
{
  return textureSample(uTexture, uSampler, uv);
}
```

Custom textures are bound after `shaderUniforms` in lexical order by texture
key, starting at `@group(1) @binding(1)`. All textures use the built-in
`uSampler` in v1.

### WebGPU Transition Compositor Scaffold

Transition compositor WGSL uses the same global group, but `uTexture` is the
previous surface and `uNextTexture` is bound at `@group(1) @binding(1)`.
Custom textures start at `@group(1) @binding(2)` in lexical order by texture
key.

```wgsl
struct GlobalFilterUniforms {
  uInputSize: vec4<f32>,
  uInputPixel: vec4<f32>,
  uInputClamp: vec4<f32>,
  uOutputFrame: vec4<f32>,
  uGlobalFrame: vec4<f32>,
  uOutputTexture: vec4<f32>,
};

struct ShaderUniforms {
  uProgress: f32,
  uResolution: vec2<f32>,
  // custom uniforms follow
};

@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> shaderUniforms: ShaderUniforms;
@group(1) @binding(1) var uNextTexture: texture_2d<f32>;

struct VSOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

fn filterVertexPosition(aPosition: vec2<f32>) -> vec4<f32>
{
  var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;

  position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;

  return vec4(position, 0.0, 1.0);
}

fn filterTextureCoord(aPosition: vec2<f32>) -> vec2<f32>
{
  return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);
}

@vertex
fn mainVertex(@location(0) aPosition: vec2<f32>) -> VSOutput
{
  return VSOutput(
    filterVertexPosition(aPosition),
    filterTextureCoord(aPosition),
  );
}

@fragment
fn mainFragment(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32>
{
  let prevColor = textureSample(uTexture, uSampler, uv);
  let nextColor = textureSample(uNextTexture, uSampler, uv);
  return mix(prevColor, nextColor, shaderUniforms.uProgress);
}
```

## Built-In Shader Inputs

Element filter shaders receive:

```txt
uTexture
uProgress
uResolution
custom uniforms
custom textures
```

Built-in uniform types:

```txt
uProgress: float
uResolution: vec2, target pass size in pixels
```

Transition compositor shaders receive:

```txt
uTexture, previous rendered surface
uNextTexture
uProgress
uResolution
custom uniforms
custom textures
```

Built-in texture inputs:

```txt
uTexture: current element/container surface for filter shaders
uTexture: previous transition surface for compositor shaders
uNextTexture: next transition surface for compositor shaders
```

Built-in generated shader symbols are reserved and cannot be produced by custom
uniform or texture names:

```txt
uTexture
uPrevTexture
uNextTexture
uProgress
uResolution
uSampler
```

Validation must check the generated shader symbol, not just the raw YAML key.
For example, `textures.prev` is invalid because it would generate
`uPrevTexture`.

`uPrevTexture` is reserved even though v1 compositor shaders use `uTexture` for
the previous surface. This keeps room for a future explicit alias without
breaking custom texture names.

These WGSL ABI identifiers are also reserved:

```txt
GlobalFilterUniforms
ShaderUniforms
VSOutput
gfu
shaderUniforms
mainVertex
mainFragment
uInputSize
uInputPixel
uInputClamp
uOutputFrame
uGlobalFrame
uOutputTexture
```

WGSL source must use these names with the layout documented above. Custom
uniform and texture names must not generate symbols that collide with any
reserved ABI identifier.

## Name Mapping

Uniform and texture keys must use lower camel case:

```txt
^[a-z][A-Za-z0-9]*$
```

Invalid keys include:

```txt
snake_case
kebab-case
1stTexture
```

Generated shader symbols must be unique across all custom uniforms and textures.
For example, this is invalid because both keys generate `uNoiseTexture`:

```yaml
uniforms:
  noiseTexture: 1
textures:
  noise: "textures/noise.png"
```

### Uniforms

YAML uniform names are author-facing names. Route Graphics exposes them to
shader code with a `u` prefix and PascalCase conversion.

```yaml
uniforms:
  radius: 0.35
  shadowStrength: 0.6
```

Maps to:

```txt
radius -> uRadius
shadowStrength -> uShadowStrength
```

WebGL:

```glsl
uniform float uRadius;
uniform float uShadowStrength;
```

V1 uniform values are inferred from YAML values:

```txt
number -> float
[number, number] -> vec2
[number, number, number, number] -> vec4
```

Colors should be passed as normalized vec4 arrays in v1:

```yaml
uniforms:
  tint: [1, 0.8, 0.4, 1]
```

For WGSL, `ShaderUniforms` fields must be declared in this order:

```txt
uProgress
uResolution
custom uniforms in lexical order by YAML key
```

Shader authors do not manually specify byte offsets. The implementation owns
packing for the documented `f32`, `vec2<f32>`, and `vec4<f32>` field types.

V1 intentionally does not support vec3 custom uniforms. Use vec4 instead. This
avoids avoidable WGSL uniform alignment ambiguity in the first implementation.

### Textures

Texture keys are logical texture slot names. Route Graphics exposes each texture
as:

```txt
u<Name>Texture
```

where `<Name>` is the PascalCase version of the YAML key.

```yaml
textures:
  noise: "textures/noise.png"
  displacementMap: "textures/water-noise.png"
```

Maps to:

```txt
noise -> uNoiseTexture
displacementMap -> uDisplacementMapTexture
```

WebGL:

```glsl
uniform sampler2D uNoiseTexture;
uniform sampler2D uDisplacementMapTexture;
```

WebGPU uses the same logical texture names and the binding layout defined in
the source scaffolds above.

Portable texture budget for v1:

```txt
filter shader:
  uTexture + up to 7 custom textures

transition compositor shader:
  uTexture + uNextTexture + up to 6 custom textures
```

This keeps each shader pass within an 8-texture budget.

## Coordinates

Shader UV coordinates use normalized texture space:

```txt
x: 0..1 left to right
y: 0..1 top to bottom
```

`uResolution` is the pass size in pixels:

```txt
uResolution.x = width
uResolution.y = height
```

`uResolution` is in logical Route Graphics pixels, not device pixels. This keeps
shader output deterministic across high-DPI and video-rendering environments.

## Mesh

`mesh` controls the geometry used by the shader pass.

```yaml
mesh:
  grid: [64, 2]
```

`grid` is `[columns, rows]`.

Default:

```yaml
mesh:
  grid: [1, 1]
```

A one-quad compositor mesh is enough for dissolves, wipes, and most transition
UV distortion effects.

A subdivided mesh is needed for geometry deformation effects such as page curl
or book flip.

V1 mesh rules:

- `mesh` is valid only on transition compositors
- element filters always use one full-target quad
- mesh vertices are generated in normalized `0..1` target space
- mesh deformation does not affect layout, hit testing, z-order, or element
  bounds
- output is clipped to the transition target bounds
- effects that need to draw outside the target bounds must enlarge the target
  container or wait for a future explicit padding option

## Pipeline

`pipeline` contains low-level draw and sampling options. It is optional.

```yaml
pipeline:
  blend: normal
  textureWrap: clamp
  mipmap: false
```

Initial v1 options:

- `blend`: `normal | add | multiply | screen`
- `textureWrap`: `clamp | repeat`
- `mipmap`: boolean

`textureWrap` and `mipmap` apply only to custom textures from `textures`.
Built-in render textures such as `uTexture` and `uNextTexture` are always
sampled as clamped, non-mipmapped render targets in v1.

`blend` controls how the shader pass output is composited onto the parent
framebuffer. It does not blend the shader output with `uTexture` inside the
shader. If a shader needs to mix with its input, it should sample `uTexture` and
perform that mix in shader code.

For element `filters[]`, intermediate filters render into the next filter input,
not the parent framebuffer. In v1, `blend` is applied only when the final filter
output is drawn to the parent framebuffer. Intermediate filter passes behave as
`normal`.

For transition compositors, `blend` applies when the compositor output is drawn
to the parent framebuffer.

Most shaders should not need to set `pipeline`.

## Examples

### Complete Minimal Grayscale Filter

```yaml
elements:
  - id: portrait
    type: sprite
    src: "portrait.png"
    width: 400
    height: 700
    filters:
      - id: grayscale
        type: shader
        uniforms:
          amount: 1
        source:
          webgl:
            fragment: |
              precision mediump float;

              in vec2 vTextureCoord;
              out vec4 finalColor;

              uniform sampler2D uTexture;
              uniform float uAmount;

              void main() {
                vec4 color = texture(uTexture, vTextureCoord);
                float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
                finalColor = vec4(mix(color.rgb, vec3(gray), uAmount), color.a);
              }
          webgpu:
            source: |
              struct GlobalFilterUniforms {
                uInputSize: vec4<f32>,
                uInputPixel: vec4<f32>,
                uInputClamp: vec4<f32>,
                uOutputFrame: vec4<f32>,
                uGlobalFrame: vec4<f32>,
                uOutputTexture: vec4<f32>,
              };

              struct ShaderUniforms {
                uProgress: f32,
                uResolution: vec2<f32>,
                uAmount: f32,
              };

              @group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
              @group(0) @binding(1) var uTexture: texture_2d<f32>;
              @group(0) @binding(2) var uSampler: sampler;
              @group(1) @binding(0) var<uniform> shaderUniforms: ShaderUniforms;

              struct VSOutput {
                @builtin(position) position: vec4<f32>,
                @location(0) uv: vec2<f32>,
              };

              fn filterVertexPosition(aPosition: vec2<f32>) -> vec4<f32>
              {
                var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;

                position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
                position.y = position.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;

                return vec4<f32>(position, 0.0, 1.0);
              }

              fn filterTextureCoord(aPosition: vec2<f32>) -> vec2<f32>
              {
                return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);
              }

              @vertex
              fn mainVertex(@location(0) aPosition: vec2<f32>) -> VSOutput
              {
                return VSOutput(
                  filterVertexPosition(aPosition),
                  filterTextureCoord(aPosition),
                );
              }

              @fragment
              fn mainFragment(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32>
              {
                let color = textureSample(uTexture, uSampler, uv);
                let gray = dot(color.rgb, vec3<f32>(0.299, 0.587, 0.114));
                let rgb = mix(color.rgb, vec3<f32>(gray), shaderUniforms.uAmount);
                return vec4<f32>(rgb, color.a);
              }
```

### Ordered Filter Stack

```yaml
elements:
  - id: scene-root
    type: container
    width: 1280
    height: 720
    filters:
      - id: color-grade
        type: shader
        uniforms:
          exposure: 0.05
          contrast: 1.12
          saturation: 0.9
        source:
          webgl:
            fragment: |
              // color grade GLSL
          webgpu:
            source: |
              // color grade WGSL
      - id: crt
        type: shader
        uniforms:
          curvature: 0.06
          scanlineStrength: 0.18
        source:
          webgl:
            fragment: |
              // CRT GLSL
          webgpu:
            source: |
              // CRT WGSL
      - id: vignette
        type: shader
        uniforms:
          radius: 0.78
          softness: 0.25
          opacity: 0.45
        source:
          webgl:
            fragment: |
              // vignette GLSL
          webgpu:
            source: |
              // vignette WGSL
```

### Animated Glitch Filter

```yaml
elements:
  - id: scene-root
    type: container
    width: 1280
    height: 720
    filters:
      - id: glitch
        type: shader
        uniforms:
          strength: 0.4
        source:
          webgl:
            fragment: |
              // Uses uProgress to control glitch amount.
          webgpu:
            source: |
              // Uses uProgress to control glitch amount.

animations:
  - id: glitch-burst
    targetId: scene-root
    type: update
    tween:
      uProgress:
        initialValue: 0
        keyframes:
          - duration: 80
            value: 1
            easing: linear
          - duration: 120
            value: 0
            easing: linear
```

### Page Turn Transition

```yaml
animations:
  - id: page-turn
    targetId: scene-root
    type: transition
    tween:
      uProgress:
        initialValue: 0
        keyframes:
          - duration: 800
            value: 1
            easing: easeInOutCubic
    compositor:
      type: shader
      uniforms:
        radius: 0.35
        shadowStrength: 0.6
      mesh:
        grid: [64, 2]
      source:
        webgl:
          vertex: |
            // Deform the page mesh using uProgress.
          fragment: |
            // Sample uTexture and uNextTexture.
        webgpu:
          source: |
            // WGSL source with mainVertex and mainFragment.
```

## Validation Rules

- element `filters` is optional
- each filter in `filters` must define `id`, `type: shader`, and `source`
- filter ids must be unique within the element's filter list
- filter order is the array order
- `source.webgl.fragment` is required
- `source.webgpu.source` is required
- `source.webgl.vertex` is optional for simple filters and non-deforming
  compositors
- both WebGL and WebGPU source are required
- `compositor` is valid only on `type: transition`
- transition `compositor.type` must be `shader`
- v1 allows at most one transition compositor
- `compositor` and `mask` are mutually exclusive in v1
- a transition must define at least one of `prev`, `next`, `mask`, or
  `compositor`
- top-level `transition.tween` is valid only when `compositor` is present
- top-level `transition.tween` may contain only `uProgress`
- `compositor` requires top-level `tween.uProgress`
- `uProgress` is the only shader tween property in v1
- multiple active `uProgress` animations for the same `targetId` in one render
  are invalid
- arbitrary uniform tween paths are not valid in v1
- custom uniform and texture keys must match `^[a-z][A-Za-z0-9]*$`
- custom uniform and texture generated symbols must be unique
- custom uniform and texture names cannot collide with reserved built-ins
