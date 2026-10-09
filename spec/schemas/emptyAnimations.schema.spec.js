import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv from "ajv";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import { normalizeAnimations } from "../../src/util/normalizeAnimations.js";

const readYaml = async (url) => yaml.load(await readFile(url, "utf8"));
const testDirectory = dirname(fileURLToPath(import.meta.url));
// Existing schemas use $def for reusable definitions. Let Ajv resolve those
// JSON pointers while accepting this annotation in the draft-07 documents.
const ajv = new Ajv({
  strict: false,
  allErrors: true,
  loadSchema: (uri) => readYaml(new URL(uri)),
});

const compileSchema = async (relativePath) => {
  const url = pathToFileURL(
    resolve(testDirectory, "../../src/schemas", relativePath),
  );
  return ajv.compileAsync({ ...(await readYaml(url)), $id: url.href });
};

const validateAnimation = await compileSchema("animations/animation.yaml");

const compositorSource = {
  webgl: {
    fragment: `
      in vec2 vTextureCoord;
      out vec4 finalColor;
      uniform sampler2D uTexture;
      uniform sampler2D uNextTexture;
      uniform float uProgress;
      void main() {
        finalColor = mix(texture(uTexture, vTextureCoord), texture(uNextTexture, vTextureCoord), uProgress);
      }
    `,
  },
  webgpu: {
    source: `
      struct VSOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) uv: vec2<f32>,
      };
      @vertex fn mainVertex(@location(0) aPosition: vec2<f32>) -> VSOutput {
        return VSOutput(vec4<f32>(aPosition, 0.0, 1.0), aPosition);
      }
      @fragment fn mainFragment(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        return vec4<f32>(uv, 0.0, 1.0);
      }
    `,
  },
};

const progressTween = {
  progress: {
    initialValue: 0,
    keyframes: [{ duration: 100, value: 1, easing: "linear" }],
  },
};

const createCompositor = (overrides = {}) => ({
  type: "shader",
  source: compositorSource,
  tween: progressTween,
  ...overrides,
});

const updateAnimation = (tween) => ({
  id: "update",
  targetId: "panel",
  type: "update",
  tween,
});

const transitionAnimation = (overrides = {}) => ({
  id: "transition",
  targetId: "panel",
  type: "transition",
  ...overrides,
});

const expectValid = (animation) => {
  expect(
    validateAnimation(animation),
    JSON.stringify(validateAnimation.errors, null, 2),
  ).toBe(true);
};

const expectInvalid = (animation) => {
  expect(
    validateAnimation(animation),
    JSON.stringify(validateAnimation.errors, null, 2),
  ).toBe(false);
};

describe("animation schema empty authoring", () => {
  const manualLocations = [
    ["ordinary property", (track) => updateAnimation({ x: track })],
    ["rect dimension", (track) => updateAnimation({ width: track })],
    ["rect color", (track) => updateAnimation({ fill: { color: track } })],
    [
      "filter parameter",
      (track) => updateAnimation({ filters: { glow: { progress: track } } }),
    ],
    [
      "transition surface",
      (track) => transitionAnimation({ next: { tween: { alpha: track } } }),
    ],
  ];

  it.each(
    manualLocations.flatMap(([name, create]) => [
      [
        `${name} with auto and keyframes`,
        create({ keyframes: [], auto: { duration: 100 } }),
      ],
      [`${name} with an unknown field`, create({ keyframes: [], typo: true })],
    ]),
  )("rejects an empty %s before pruning", (_name, animation) => {
    expectInvalid(animation);
    expect(() => normalizeAnimations([animation])).toThrow();
  });

  it("validates the actual visual fixture's authored animations", async () => {
    const [, fixture] = yaml.loadAll(
      await readFile(
        resolve(
          testDirectory,
          "../../vt/specs/timeline/empty-tween-tracks.yaml",
        ),
        "utf8",
      ),
    );
    for (const state of fixture.states) {
      for (const animation of state.animations ?? []) expectValid(animation);
      expect(() => normalizeAnimations(state.animations ?? [])).not.toThrow();
    }
  });

  it.each(["prev", "next"])(
    "rejects unknown fields on an empty %s side",
    (side) => {
      const animation = transitionAnimation({
        [side]: { tween: {}, typo: true },
      });
      expectInvalid(animation);
      expect(() => normalizeAnimations([animation])).toThrow(
        `${side}.typo is not supported`,
      );
    },
  );

  it.each([
    ["empty update tween map", updateAnimation({})],
    [
      "empty manual keyframes with a valid initialValue",
      updateAnimation({ x: { initialValue: 5, keyframes: [] } }),
    ],
    [
      "empty rect width and height tracks",
      updateAnimation({ width: { keyframes: [] }, height: { keyframes: [] } }),
    ],
    ["empty fill map", updateAnimation({ fill: {} })],
    [
      "empty fill color track",
      updateAnimation({ fill: { color: { keyframes: [] } } }),
    ],
    [
      "empty fill color track with a valid initialValue",
      updateAnimation({
        fill: { color: { initialValue: "#ff0000", keyframes: [] } },
      }),
    ],
    ["empty gradient point map", updateAnimation({ fill: { start: {} } })],
    [
      "empty gradient point axis track",
      updateAnimation({ fill: { end: { y: { keyframes: [] } } } }),
    ],
    ["empty gradient stops array", updateAnimation({ fill: { stops: [] } })],
    [
      "gradient stop with only empty tracks",
      updateAnimation({
        fill: { stops: [{ index: 1, offset: { keyframes: [] } }] },
      }),
    ],
    ["empty border map", updateAnimation({ border: {} })],
    [
      "empty border color track",
      updateAnimation({ border: { color: { keyframes: [] } } }),
    ],
    ["empty per-corner map", updateAnimation({ cornerRadius: {} })],
    [
      "empty per-corner track",
      updateAnimation({ cornerRadius: { topLeft: { keyframes: [] } } }),
    ],
    [
      "empty uniform corner radius track",
      updateAnimation({ cornerRadius: { keyframes: [] } }),
    ],
    ["empty filter map", updateAnimation({ filters: {} })],
    ["empty filter parameter map", updateAnimation({ filters: { glow: {} } })],
    [
      "empty filter parameter track with a valid initialValue",
      updateAnimation({
        filters: { glow: { amount: { initialValue: 0.5, keyframes: [] } } },
      }),
    ],
    [
      "empty filter progress track",
      updateAnimation({ filters: { glow: { progress: { keyframes: [] } } } }),
    ],
    [
      "empty tracks beside nonempty tracks",
      updateAnimation({
        x: { keyframes: [] },
        y: { keyframes: [{ value: 10, duration: 100 }] },
        fill: {
          color: { keyframes: [] },
          stops: [
            { index: 0, offset: { keyframes: [] } },
            {
              index: 1,
              color: { keyframes: [{ value: "#0000ff", duration: 300 }] },
            },
          ],
        },
        border: {
          width: { keyframes: [] },
          alpha: { auto: { duration: 100 } },
        },
        filters: {
          glow: {
            strength: { keyframes: [{ value: 0.8, duration: 100 }] },
            amount: { keyframes: [] },
          },
          empty: {},
        },
      }),
    ],
    ["empty transition side", transitionAnimation({ prev: {} })],
    [
      "empty transition side tween map",
      transitionAnimation({ prev: { tween: {} } }),
    ],
    [
      "empty transition side track beside an active side",
      transitionAnimation({
        prev: { tween: { alpha: { keyframes: [] } } },
        next: {
          tween: { alpha: { keyframes: [{ value: 1, duration: 100 }] } },
        },
      }),
    ],
  ])("accepts %s", (_name, animation) => {
    expectValid(animation);
    expect(() => normalizeAnimations([animation])).not.toThrow();
  });

  it.each([
    ["missing keyframes", updateAnimation({ x: {} })],
    [
      "keyframes and auto together",
      updateAnimation({ x: { keyframes: [], auto: { duration: 100 } } }),
    ],
    [
      "invalid initialValue beside empty keyframes",
      updateAnimation({ x: { initialValue: "fast", keyframes: [] } }),
    ],
    [
      "invalid color initialValue beside empty keyframes",
      updateAnimation({ fill: { color: { initialValue: 42, keyframes: [] } } }),
    ],
    [
      "invalid filter initialValue beside empty keyframes",
      updateAnimation({
        filters: { glow: { amount: { initialValue: "warm", keyframes: [] } } },
      }),
    ],
    [
      "x and translateX aliases with empty keyframes",
      updateAnimation({
        x: { keyframes: [] },
        translateX: { keyframes: [] },
      }),
    ],
    [
      "y and translateY aliases with one empty track",
      updateAnimation({
        y: { keyframes: [] },
        translateY: { keyframes: [{ value: 1, duration: 100 }] },
      }),
    ],
    [
      "transition side x and translateX aliases with empty keyframes",
      transitionAnimation({
        prev: {
          tween: { x: { keyframes: [] }, translateX: { keyframes: [] } },
        },
        next: {
          tween: { alpha: { keyframes: [{ value: 1, duration: 100 }] } },
        },
      }),
    ],
    [
      "empty mask progress keyframes",
      transitionAnimation({
        mask: [
          { kind: "single", texture: "wipe", progress: { keyframes: [] } },
        ],
      }),
    ],
    [
      "empty sequence mask frames",
      transitionAnimation({ mask: [{ kind: "sequence", frames: [] }] }),
    ],
    ["empty mask array", transitionAnimation({ mask: [] })],
    [
      "compositor tween missing progress",
      transitionAnimation({ compositor: createCompositor({ tween: {} }) }),
    ],
    [
      "empty compositor progress keyframes",
      transitionAnimation({
        compositor: createCompositor({
          tween: { progress: { keyframes: [] } },
        }),
      }),
    ],
    [
      "empty compositor custom parameter keyframes",
      transitionAnimation({
        compositor: createCompositor({
          tween: {
            ...progressTween,
            edgeWidth: { keyframes: [] },
          },
        }),
      }),
    ],
    [
      "gradient stop without an index",
      updateAnimation({
        fill: { stops: [{ offset: { keyframes: [] } }] },
      }),
    ],
    [
      "gradient stop without an animated channel",
      updateAnimation({ fill: { stops: [{ index: 0 }] } }),
    ],
    [
      "negative gradient stop index",
      updateAnimation({
        fill: { stops: [{ index: -1, offset: { keyframes: [] } }] },
      }),
    ],
    ["empty filter id", updateAnimation({ filters: { "": {} } })],
    [
      "reserved filter parameter with empty keyframes",
      updateAnimation({ filters: { glow: { uTime: { keyframes: [] } } } }),
    ],
    [
      "invalid filter parameter pattern with empty keyframes",
      updateAnimation({
        filters: { glow: { "edge-width": { keyframes: [] } } },
      }),
    ],
    [
      "empty gsap steps",
      {
        id: "empty-gsap",
        targetId: "panel",
        type: "update",
        gsap: {
          profile: "portable-v1",
          targets: { panel: { element: "panel" } },
          steps: [],
        },
      },
    ],
  ])("still rejects %s", (_name, animation) => {
    expectInvalid(animation);
    expect(() => normalizeAnimations([animation])).toThrow();
  });

  it("keeps accepting ordinary nonempty timelines", () => {
    expectValid(
      updateAnimation({
        alpha: { initialValue: 0, keyframes: [{ duration: 100, value: 1 }] },
        x: { auto: { duration: 100, easing: "easeOutCubic" } },
        fill: {
          color: { keyframes: [{ duration: 100, value: "#00ff00" }] },
          stops: [{ index: 1, offset: { auto: { duration: 100 } } }],
        },
        filters: {
          glow: {
            tint: { keyframes: [{ duration: 100, value: [0, 0.5, 1] }] },
          },
        },
      }),
    );
    expectValid(
      transitionAnimation({
        prev: {
          tween: { alpha: { keyframes: [{ duration: 100, value: 0 }] } },
        },
        mask: [
          {
            kind: "single",
            texture: "wipe",
            progress: {
              keyframes: [{ duration: 100, value: 1 }],
            },
          },
        ],
        compositor: createCompositor({
          tween: {
            ...progressTween,
            edgeWidth: { keyframes: [{ duration: 100, value: 0.2 }] },
          },
        }),
      }),
    );
  });

  it("keeps rejecting unrelated structural invariants", () => {
    expectInvalid({
      id: "update-with-prev",
      targetId: "panel",
      type: "update",
      tween: {},
      prev: { tween: {} },
    });
    expectInvalid(
      transitionAnimation({
        tween: { x: { keyframes: [] } },
        prev: { tween: {} },
      }),
    );
    expectInvalid(updateAnimation({ x: { keyframes: [{ duration: 100 }] } }));
  });
});
