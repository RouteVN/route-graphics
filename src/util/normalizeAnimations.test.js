import { describe, expect, it } from "vitest";
import { normalizeAnimations } from "./normalizeAnimations.js";

describe("normalizeAnimations empty timelines", () => {
  it("omits empty update tweens and keyframe tracks", () => {
    expect(
      normalizeAnimations([
        { id: "empty-tween", targetId: "panel", type: "update", tween: {} },
        {
          id: "empty-keyframes",
          targetId: "panel",
          type: "update",
          tween: { x: { keyframes: [] } },
        },
        {
          id: "mixed-tracks",
          targetId: "panel",
          type: "update",
          tween: {
            x: { keyframes: [] },
            y: { keyframes: [{ value: 10, duration: 100 }] },
          },
        },
      ]),
    ).toEqual([
      {
        id: "mixed-tracks",
        targetId: "panel",
        type: "update",
        tween: {
          y: {
            keyframes: [{ value: 10, duration: 100, easing: "linear" }],
          },
        },
      },
    ]);
  });

  it("omits empty transition sides and keeps the active side", () => {
    expect(
      normalizeAnimations([
        {
          id: "empty-transition",
          targetId: "panel",
          type: "transition",
          prev: { tween: {} },
          next: {},
        },
        {
          id: "mixed-transition",
          targetId: "panel",
          type: "transition",
          prev: { tween: { alpha: { keyframes: [] } } },
          next: {
            tween: {
              alpha: { keyframes: [{ value: 1, duration: 100 }] },
            },
          },
        },
      ]),
    ).toEqual([
      {
        id: "mixed-transition",
        targetId: "panel",
        type: "transition",
        next: {
          tween: {
            alpha: {
              keyframes: [{ value: 1, duration: 100, easing: "linear" }],
            },
          },
        },
      },
    ]);
  });

  it("drops rect style animations whose manual tracks are all empty", () => {
    expect(
      normalizeAnimations(
        [
          { width: { keyframes: [] }, height: { keyframes: [] } },
          { fill: {} },
          { fill: { color: { keyframes: [] } } },
          { fill: { start: {} } },
          { fill: { end: { y: { keyframes: [] } } } },
          { fill: { innerRadius: { keyframes: [] } } },
          { fill: { outerRadius: { keyframes: [] } } },
          { fill: { scale: { keyframes: [] }, rotation: { keyframes: [] } } },
          { fill: { stops: [] } },
          {
            fill: { stops: [{ index: 0, offset: { keyframes: [] } }] },
          },
          {
            fill: {
              stops: [{ index: 2, color: { keyframes: [] } }],
            },
          },
          { border: {} },
          { border: { width: { keyframes: [] } } },
          { border: { color: { keyframes: [] } } },
          { border: { alpha: { keyframes: [] } } },
          { cornerRadius: {} },
          { cornerRadius: { topLeft: { keyframes: [] } } },
          { cornerRadius: { keyframes: [] } },
        ].map((tween, index) => ({
          id: `empty-rect-${index}`,
          targetId: "panel",
          type: "update",
          tween,
        })),
      ),
    ).toEqual([]);
  });

  it("keeps nonempty rect tracks beside empty sibling tracks", () => {
    const [animation] = normalizeAnimations([
      {
        id: "mixed-rect",
        targetId: "panel",
        type: "update",
        tween: {
          width: { keyframes: [] },
          height: { keyframes: [{ value: 120, duration: 300 }] },
          fill: {
            color: { keyframes: [] },
            start: { x: { keyframes: [] } },
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
            alpha: { keyframes: [{ value: 0.5, duration: 100 }] },
          },
          cornerRadius: {
            topLeft: { keyframes: [] },
            bottomRight: { auto: { duration: 300 } },
          },
        },
      },
    ]);

    expect(Object.keys(animation.tween)).toEqual([
      "rect.height",
      "rect.fill.stops.1.color",
      "rect.border.alpha",
      "rect.cornerRadius.bottomRight",
    ]);
    expect(
      animation.tween["rect.fill.stops.1.color"].keyframes[0].value,
    ).toEqual([0, 0, 1, 1]);
  });

  it("drops update animations whose filter authoring is empty", () => {
    expect(
      normalizeAnimations(
        [
          { filters: {} },
          { filters: { glow: {} } },
          { filters: { glow: { amount: { keyframes: [] } } } },
          { filters: { glow: { progress: { keyframes: [] } } } },
          {
            filters: {
              glow: { amount: { keyframes: [] } },
              grade: { tint: { keyframes: [] } },
            },
          },
          {
            filters: {
              glow: { amount: { keyframes: [] }, strength: { keyframes: [] } },
            },
          },
        ].map((tween, index) => ({
          id: `empty-filters-${index}`,
          targetId: "panel",
          type: "update",
          tween,
        })),
      ),
    ).toEqual([]);
  });

  it("keeps nonempty filter tracks when sibling filters or parameters prune", () => {
    const [animation] = normalizeAnimations([
      {
        id: "mixed-filters",
        targetId: "panel",
        type: "update",
        tween: {
          filters: {
            glow: {
              strength: { keyframes: [{ value: 0.8, duration: 100 }] },
              amount: { keyframes: [] },
            },
            empty: {},
            grade: { progress: { keyframes: [] } },
          },
        },
      },
    ]);

    expect(animation.filterTweens).toEqual({
      glow: {
        strength: {
          keyframes: [{ value: 0.8, duration: 100, easing: "linear" }],
        },
      },
    });
  });

  it("keeps element tracks when rect and filter authoring prune", () => {
    const [animation] = normalizeAnimations([
      {
        id: "mixed-surfaces",
        targetId: "panel",
        type: "update",
        tween: {
          x: { keyframes: [] },
          y: { keyframes: [{ value: 10, duration: 100 }] },
          fill: {},
          filters: { glow: {} },
        },
      },
    ]);

    expect(animation).toEqual({
      id: "mixed-surfaces",
      targetId: "panel",
      type: "update",
      tween: {
        y: { keyframes: [{ value: 10, duration: 100, easing: "linear" }] },
      },
    });
    expect(animation).not.toHaveProperty("filterTweens");
  });
});

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

describe("normalizeAnimations shader support", () => {
  it("normalizes delays for manual, auto, filter, mask, and compositor tracks", () => {
    const [updateAnimation, transitionAnimation] = normalizeAnimations([
      {
        id: "delayed-update",
        targetId: "panel",
        type: "update",
        tween: {
          x: {
            initialValue: 0,
            keyframes: [{ delay: 100, duration: 200, value: 50 }],
          },
          alpha: {
            auto: { delay: 150, duration: 250 },
          },
          y: {
            auto: { delay: 0, duration: 250 },
          },
          filters: {
            grade: {
              tint: {
                keyframes: [
                  { delay: 300, duration: 400, value: [0.2, 0.4, 0.6] },
                ],
              },
            },
          },
        },
      },
      {
        id: "delayed-transition",
        targetId: "scene",
        type: "transition",
        mask: [
          {
            kind: "single",
            texture: "wipe",
            delay: 400,
            progress: {
              keyframes: [{ delay: 500, duration: 600, value: 1 }],
            },
          },
        ],
        compositor: createCompositor({
          parameters: { edgeWidth: 0.04 },
          tween: {
            progress: {
              keyframes: [{ delay: 700, duration: 800, value: 1 }],
            },
            edgeWidth: {
              keyframes: [{ delay: 900, duration: 1000, value: 0.12 }],
            },
          },
        }),
      },
    ]);

    expect(updateAnimation.tween.x.keyframes[0]).toMatchObject({
      delay: 100,
      duration: 200,
      value: 50,
    });
    expect(updateAnimation.tween.alpha.auto).toEqual({
      delay: 150,
      duration: 250,
      easing: "linear",
    });
    expect(updateAnimation.tween.y.auto).toEqual({
      duration: 250,
      easing: "linear",
    });
    expect(updateAnimation.filterTweens.grade.tint.keyframes[0]).toMatchObject({
      delay: 300,
      duration: 400,
      value: [0.2, 0.4, 0.6],
    });
    expect(transitionAnimation.mask[0].delay).toBe(400);
    expect(transitionAnimation.mask[0].progress.keyframes[0].delay).toBe(500);
    expect(
      transitionAnimation.compositor.tween.uProgress.keyframes[0].delay,
    ).toBe(700);
    expect(
      transitionAnimation.compositor.tween.edgeWidth.keyframes[0].delay,
    ).toBe(900);
  });

  it.each([
    ["manual", { keyframes: [{ delay: -1, duration: 100, value: 1 }] }],
    ["auto", { auto: { delay: -1, duration: 100 } }],
    [
      "fractional negative",
      { keyframes: [{ delay: -0.001, duration: 100, value: 1 }] },
    ],
    [
      "non-finite manual",
      {
        keyframes: [
          { delay: Number.POSITIVE_INFINITY, duration: 100, value: 1 },
        ],
      },
    ],
    ["non-finite auto", { auto: { delay: Number.NaN, duration: 100 } }],
    [
      "negative infinite auto",
      { auto: { delay: Number.NEGATIVE_INFINITY, duration: 100 } },
    ],
    ["string manual", { keyframes: [{ delay: "0", duration: 100, value: 1 }] }],
    ["null auto", { auto: { delay: null, duration: 100 } }],
  ])("rejects invalid %s delays", (_name, x) => {
    expect(() =>
      normalizeAnimations([
        {
          id: "invalid-delay",
          targetId: "panel",
          type: "update",
          tween: { x },
        },
      ]),
    ).toThrow(/delay must be a finite number greater than or equal to 0/);
  });

  it.each([
    [
      "filter parameter",
      {
        id: "invalid-filter-delay",
        targetId: "panel",
        type: "update",
        tween: {
          filters: {
            grade: {
              amount: {
                keyframes: [{ delay: -1, duration: 100, value: 1 }],
              },
            },
          },
        },
      },
      "animations[0].tween.filters.grade.amount.keyframes[0].delay",
    ],
    [
      "mask start",
      {
        id: "invalid-mask-start-delay",
        targetId: "scene",
        type: "transition",
        mask: [
          {
            kind: "single",
            texture: "wipe",
            delay: -1,
          },
        ],
      },
      "animations[0].mask[0].delay",
    ],
    [
      "mask progress",
      {
        id: "invalid-mask-delay",
        targetId: "scene",
        type: "transition",
        mask: [
          {
            kind: "single",
            texture: "wipe",
            progress: {
              keyframes: [{ delay: -1, duration: 100, value: 1 }],
            },
          },
        ],
      },
      "animations[0].mask[0].progress.keyframes[0].delay",
    ],
    [
      "compositor progress",
      {
        id: "invalid-compositor-delay",
        targetId: "scene",
        type: "transition",
        compositor: createCompositor({
          tween: {
            progress: {
              keyframes: [{ delay: -1, duration: 100, value: 1 }],
            },
          },
        }),
      },
      "animations[0].compositor.tween.progress.keyframes[0].delay",
    ],
  ])("reports the exact invalid %s delay path", (_name, animation, path) => {
    expect(() => normalizeAnimations([animation])).toThrow(
      `${path} must be a finite number greater than or equal to 0 and an integer number of milliseconds.`,
    );
  });

  it("treats an explicit zero mask delay like an omitted delay", () => {
    const [animation] = normalizeAnimations([
      {
        id: "immediate-mask",
        targetId: "scene",
        type: "transition",
        mask: [{ kind: "single", texture: "wipe", delay: 0 }],
      },
    ]);

    expect(animation.mask[0]).not.toHaveProperty("delay");
  });

  it("normalizes multiple masks with independent progress and delay", () => {
    const [animation] = normalizeAnimations([
      {
        id: "multi-mask",
        targetId: "scene",
        type: "transition",
        mask: [
          { kind: "single", texture: "left" },
          { kind: "single", texture: "right", delay: 250 },
        ],
      },
    ]);

    expect(animation.mask).toHaveLength(2);
    expect(animation.mask[0]).toMatchObject({
      kind: "single",
      texture: "left",
    });
    expect(animation.mask[1]).toMatchObject({
      kind: "single",
      texture: "right",
      delay: 250,
    });
  });

  it("normalizes the legacy single-object mask shape to one array entry", () => {
    const sourceMask = { kind: "single", texture: "wipe", delay: 100 };
    const [animation] = normalizeAnimations([
      {
        id: "legacy-mask-object",
        targetId: "scene",
        type: "transition",
        mask: sourceMask,
      },
    ]);

    expect(animation.mask).toEqual([
      expect.objectContaining({
        kind: "single",
        texture: "wipe",
        delay: 100,
      }),
    ]);
    expect(animation.mask[0]).not.toBe(sourceMask);
  });

  it("rejects an empty transition mask array", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "invalid-mask-array",
          targetId: "scene",
          type: "transition",
          mask: [],
        },
      ]),
    ).toThrow("animations[0].mask must be a non-empty array.");
  });

  it("preserves legacy mask error paths for top-level gsap", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "legacy-gsap-mask-delay",
          targetId: "scene",
          type: "transition",
          mask: { kind: "single", texture: "wipe", delay: 100 },
          gsap: {
            profile: "portable-v1",
            targets: { reveal: { transitionMask: true } },
            steps: [
              { kind: "set", targets: "reveal", values: { progress: 1 } },
            ],
          },
        },
      ]),
    ).toThrow(
      "animations[0].mask.delay cannot be mixed with top-level gsap. Delay the transitionMask action instead.",
    );
  });

  it("keeps mask resource timing out of orchestrated gsap transitions", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "orchestrated-mask-delay",
          targetId: "scene",
          type: "transition",
          mask: [{ kind: "single", texture: "wipe", delay: 100 }],
          gsap: {
            profile: "portable-v1",
            targets: { reveal: { transitionMask: true } },
            steps: [
              {
                kind: "set",
                targets: "reveal",
                values: { progress: 1 },
              },
            ],
          },
        },
      ]),
    ).toThrow(
      "animations[0].mask[0].delay cannot be mixed with top-level gsap. Delay the transitionMask action instead.",
    );
  });

  it("keeps ordinary update tweens unchanged", () => {
    const [animation] = normalizeAnimations([
      {
        id: "enter",
        targetId: "scene",
        type: "update",
        tween: {
          alpha: {
            initialValue: 0,
            keyframes: [{ duration: 100, value: 1 }],
          },
          x: {
            auto: { duration: 100, easing: "easeOutCubic" },
          },
        },
      },
    ]);

    expect(animation.tween.alpha.keyframes[0].value).toBe(1);
    expect(animation.tween.x.auto.easing).toBe("easeOutCubic");
  });

  it("normalizes filter-only updates and vector parameters", () => {
    const [animation] = normalizeAnimations([
      {
        id: "pulse-glow",
        targetId: "scene",
        type: "update",
        tween: {
          filters: {
            glow: {
              tint: {
                initialValue: [1, 0, 0],
                keyframes: [
                  {
                    duration: 200,
                    value: [0, 0.5, 1],
                    easing: "linear",
                  },
                ],
              },
            },
          },
        },
      },
    ]);

    expect(animation.tween).toBeUndefined();
    expect(animation.filterTweens.glow.tint.keyframes[0].value).toEqual([
      0, 0.5, 1,
    ]);
  });

  it("combines ordinary properties and multiple filter targets", () => {
    const [animation] = normalizeAnimations([
      {
        id: "combined",
        targetId: "scene",
        type: "update",
        tween: {
          alpha: {
            keyframes: [{ duration: 100, value: 1 }],
          },
          filters: {
            glow: {
              strength: {
                keyframes: [{ duration: 100, value: 0.8 }],
              },
            },
            grade: {
              progress: {
                keyframes: [{ duration: 100, value: 1 }],
              },
            },
          },
        },
      },
    ]);

    expect(animation.tween.alpha.keyframes[0].value).toBe(1);
    expect(animation.filterTweens.glow.strength.keyframes[0].value).toBe(0.8);
    expect(animation.filterTweens.grade.uProgress.keyframes[0].value).toBe(1);
  });

  it("rejects duplicate animations for the same filter parameter", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "a",
          targetId: "scene",
          type: "update",
          tween: {
            filters: {
              glow: {
                amount: {
                  keyframes: [{ duration: 100, value: 1 }],
                },
              },
            },
          },
        },
        {
          id: "b",
          targetId: "scene",
          type: "update",
          tween: {
            filters: {
              glow: {
                amount: {
                  keyframes: [{ duration: 100, value: 0 }],
                },
              },
            },
          },
        },
      ]),
    ).toThrow(/cannot both animate parameter "amount"/);
  });

  it("rejects the old detached shader animation object", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "legacy",
          targetId: "scene",
          type: "update",
          shader: {
            filterId: "glow",
            tween: {
              amount: {
                keyframes: [{ duration: 100, value: 1 }],
              },
            },
          },
        },
      ]),
    ).toThrow(/shader.*no longer supported/);
  });

  it("uses progress instead of author-facing uProgress", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "legacy-progress",
          targetId: "scene",
          type: "update",
          tween: {
            filters: {
              glow: {
                uProgress: {
                  keyframes: [{ duration: 100, value: 1 }],
                },
              },
            },
          },
        },
      ]),
    ).toThrow(/Use .*progress/);
  });

  it("requires scalar progress values", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "bad-progress",
          targetId: "scene",
          type: "update",
          tween: {
            filters: {
              glow: {
                progress: {
                  keyframes: [{ duration: 100, value: [0, 1] }],
                },
              },
            },
          },
        },
      ]),
    ).toThrow(/progress.*must be a finite number/);
  });

  it("normalizes an inline compositor tween", () => {
    const [animation] = normalizeAnimations([
      {
        id: "crossfade",
        targetId: "scene",
        type: "transition",
        compositor: createCompositor({
          parameters: {
            edgeWidth: 0.05,
          },
          tween: {
            ...progressTween,
            edgeWidth: {
              keyframes: [{ duration: 100, value: 0.2 }],
            },
          },
        }),
      },
    ]);

    expect(animation.compositor.type).toBe("shader");
    expect(animation.compositor.tween.uProgress.keyframes[0].duration).toBe(
      100,
    );
    expect(animation.compositor.tween.edgeWidth.keyframes[0].value).toBe(0.2);
  });

  it("requires compositor.tween.progress", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "bad",
          targetId: "scene",
          type: "transition",
          compositor: createCompositor({
            tween: {
              edgeWidth: {
                keyframes: [{ duration: 100, value: 0.2 }],
              },
            },
          }),
        },
      ]),
    ).toThrow(/compositor\.tween\.progress is required/);
  });

  it("allows normal surface tweens with an inline compositor tween", () => {
    const [animation] = normalizeAnimations([
      {
        id: "combined-transition",
        targetId: "scene",
        type: "transition",
        prev: {
          tween: {
            alpha: {
              keyframes: [{ duration: 100, value: 0 }],
            },
          },
        },
        next: {
          tween: {
            alpha: {
              initialValue: 0,
              keyframes: [{ duration: 100, value: 1 }],
            },
          },
        },
        compositor: createCompositor(),
      },
    ]);

    expect(animation.prev.tween.alpha.keyframes[0].value).toBe(0);
    expect(animation.next.tween.alpha.keyframes[0].value).toBe(1);
    expect(animation.compositor.tween.uProgress.keyframes[0].value).toBe(1);
  });

  it("allows a mask before the inline compositor", () => {
    const [animation] = normalizeAnimations([
      {
        id: "masked-grade",
        targetId: "scene",
        type: "transition",
        compositor: createCompositor(),
        mask: [
          {
            kind: "single",
            texture: "mask-diagonal",
          },
        ],
      },
    ]);

    expect(animation.mask[0].texture).toBe("mask-diagonal");
    expect(animation.compositor.type).toBe("shader");
  });

  it("treats time as a read-only deterministic clock", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "bad-time",
          targetId: "scene",
          type: "update",
          tween: {
            filters: {
              glow: {
                time: {
                  keyframes: [{ duration: 100, value: 1 }],
                },
              },
            },
          },
        },
      ]),
    ).toThrow(/time is read-only/);
  });

  it.each([
    ["scalar", 0.75],
    ["vec2", [0.1, 0.9]],
    ["vec3", [0.1, 0.5, 0.9]],
    ["vec4", [0.1, 0.3, 0.6, 1]],
    ["mat3", [1, 0, 0, 0, 1, 0, 0, 0, 1]],
    ["mat4", [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]],
  ])("accepts and clones %s shader tween values", (_name, value) => {
    const inputValue = Array.isArray(value) ? [...value] : value;
    const [animation] = normalizeAnimations([
      {
        id: "shape",
        targetId: "scene",
        type: "update",
        tween: {
          filters: {
            grade: {
              transform: {
                initialValue: inputValue,
                keyframes: [{ duration: 100, value: inputValue }],
              },
            },
          },
        },
      },
    ]);

    const normalized = animation.filterTweens.grade.transform;
    expect(normalized.initialValue).toEqual(value);
    expect(normalized.keyframes[0].value).toEqual(value);
    if (Array.isArray(value)) {
      expect(normalized.initialValue).not.toBe(inputValue);
      expect(normalized.keyframes[0].value).not.toBe(inputValue);
    }
  });

  it.each([
    ["empty array", []],
    ["one component", [1]],
    ["five components", [1, 2, 3, 4, 5]],
    ["non-finite scalar", Number.POSITIVE_INFINITY],
    ["non-finite component", [0, Number.NaN]],
  ])("rejects invalid shader tween shape: %s", (_name, value) => {
    expect(() =>
      normalizeAnimations([
        {
          id: "bad-shape",
          targetId: "scene",
          type: "update",
          tween: {
            filters: {
              grade: {
                transform: {
                  keyframes: [{ duration: 100, value }],
                },
              },
            },
          },
        },
      ]),
    ).toThrow(/finite number or a numeric array with length 2, 3, 4, 9, or 16/);
  });

  it("preserves relative vector keyframes", () => {
    const [animation] = normalizeAnimations([
      {
        id: "relative-vector",
        targetId: "scene",
        type: "update",
        tween: {
          filters: {
            grade: {
              tint: {
                initialValue: [0.1, 0.2, 0.3],
                keyframes: [
                  {
                    duration: 100,
                    value: [0.2, -0.1, 0.4],
                    relative: true,
                  },
                ],
              },
            },
          },
        },
      },
    ]);

    expect(animation.filterTweens.grade.tint.keyframes[0]).toEqual({
      duration: 100,
      easing: "linear",
      relative: true,
      value: [0.2, -0.1, 0.4],
    });
  });

  it("rejects an empty filter id even when its tween map is empty", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "empty-filter-id",
          targetId: "scene",
          type: "update",
          tween: {
            filters: {
              "": {},
            },
          },
        },
      ]),
    ).toThrow(/filter id must be a non-empty string/);
  });

  it.each(["Amount", "edge-width", "_amount"])(
    "rejects invalid shader parameter key %s",
    (parameter) => {
      expect(() =>
        normalizeAnimations([
          {
            id: "bad-parameter",
            targetId: "scene",
            type: "update",
            tween: {
              filters: {
                grade: {
                  [parameter]: {
                    keyframes: [{ duration: 100, value: 1 }],
                  },
                },
              },
            },
          },
        ]),
      ).toThrow(/must be progress or match/);
    },
  );

  it("allows the same parameter on different filter ids and targets", () => {
    const normalized = normalizeAnimations([
      {
        id: "scene-grade",
        targetId: "scene",
        type: "update",
        tween: {
          filters: {
            grade: {
              amount: {
                keyframes: [{ duration: 100, value: 1 }],
              },
            },
            glow: {
              amount: {
                keyframes: [{ duration: 100, value: 0.5 }],
              },
            },
          },
        },
      },
      {
        id: "title-grade",
        targetId: "title",
        type: "update",
        tween: {
          filters: {
            grade: {
              amount: {
                keyframes: [{ duration: 100, value: 0.25 }],
              },
            },
          },
        },
      },
    ]);

    expect(normalized).toHaveLength(2);
  });

  it("allows separate animations to target different parameters on one filter", () => {
    const normalized = normalizeAnimations([
      {
        id: "grade-amount",
        targetId: "scene",
        type: "update",
        tween: {
          filters: {
            grade: {
              amount: {
                keyframes: [{ duration: 100, value: 1 }],
              },
            },
          },
        },
      },
      {
        id: "grade-tint",
        targetId: "scene",
        type: "update",
        tween: {
          filters: {
            grade: {
              tint: {
                keyframes: [{ duration: 100, value: [1, 0, 0] }],
              },
            },
          },
        },
      },
    ]);

    expect(normalized).toHaveLength(2);
  });

  it("reports authored progress for duplicate progress channels", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "progress-a",
          targetId: "scene",
          type: "update",
          tween: {
            filters: {
              grade: {
                progress: {
                  keyframes: [{ duration: 100, value: 1 }],
                },
              },
            },
          },
        },
        {
          id: "progress-b",
          targetId: "scene",
          type: "update",
          tween: {
            filters: {
              grade: {
                progress: {
                  keyframes: [{ duration: 100, value: 0 }],
                },
              },
            },
          },
        },
      ]),
    ).toThrow(/cannot both animate parameter "progress"/);
  });

  it.each(["time", "uTime"])("rejects read-only shader clock key %s", (key) => {
    expect(() =>
      normalizeAnimations([
        {
          id: "clock",
          targetId: "scene",
          type: "update",
          tween: {
            filters: {
              grade: {
                [key]: {
                  keyframes: [{ duration: 100, value: 1 }],
                },
              },
            },
          },
        },
      ]),
    ).toThrow(/read-only/);
  });

  it("rejects shader progress at the ordinary tween level", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "top-progress",
          targetId: "scene",
          type: "update",
          tween: {
            uProgress: {
              keyframes: [{ duration: 100, value: 1 }],
            },
          },
        },
      ]),
    ).toThrow(/uProgress is not a supported animation property/);
  });

  it("rejects a top-level transition tween", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "legacy-transition-progress",
          targetId: "scene",
          type: "transition",
          tween: progressTween,
          compositor: createCompositor(),
        },
      ]),
    ).toThrow(/tween is not valid for transition animations/);
  });

  it("rejects authored compositor uProgress", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "legacy-compositor-progress",
          targetId: "scene",
          type: "transition",
          compositor: createCompositor({
            tween: {
              uProgress: {
                keyframes: [{ duration: 100, value: 1 }],
              },
            },
          }),
        },
      ]),
    ).toThrow(/Use .*compositor\.tween\.progress/);
  });

  it("normalizes vector and relative compositor parameter tracks", () => {
    const [animation] = normalizeAnimations([
      {
        id: "vector-compositor",
        targetId: "scene",
        type: "transition",
        compositor: createCompositor({
          parameters: {
            tint: [0.2, 0.3, 0.4],
          },
          tween: {
            ...progressTween,
            tint: {
              keyframes: [
                {
                  duration: 100,
                  value: [0.1, 0.2, 0.3],
                  relative: true,
                },
              ],
            },
          },
        }),
      },
    ]);

    expect(animation.compositor.tween.tint.keyframes[0]).toEqual({
      duration: 100,
      easing: "linear",
      relative: true,
      value: [0.1, 0.2, 0.3],
    });
  });

  it("rejects auto timelines for shader parameters", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "shader-auto",
          targetId: "scene",
          type: "update",
          tween: {
            filters: {
              grade: {
                amount: {
                  auto: { duration: 100 },
                },
              },
            },
          },
        },
      ]),
    ).toThrow(/keyframes must be a non-empty array/);
  });
});

describe("normalizeAnimations rect style support", () => {
  it("flattens complete rect style timelines into internal animation paths", () => {
    const [animation] = normalizeAnimations([
      {
        id: "reshape",
        targetId: "panel",
        type: "update",
        tween: {
          width: { auto: { duration: 300 } },
          height: {
            initialValue: 80,
            keyframes: [{ delay: 50, duration: 300, value: 120 }],
          },
          fill: {
            start: {
              x: { auto: { duration: 300 } },
            },
            stops: [
              {
                index: 1,
                offset: { auto: { duration: 300 } },
                color: {
                  initialValue: "#ff0000",
                  keyframes: [{ duration: 300, value: "#0000ff" }],
                },
              },
            ],
          },
          border: {
            width: { auto: { duration: 300 } },
            color: { auto: { duration: 300 } },
            alpha: { auto: { duration: 300 } },
          },
          cornerRadius: {
            topLeft: { auto: { duration: 300 } },
            bottomRight: { auto: { duration: 300 } },
          },
        },
      },
    ]);

    expect(Object.keys(animation.tween)).toEqual([
      "rect.width",
      "rect.height",
      "rect.fill.start.x",
      "rect.fill.stops.1.offset",
      "rect.fill.stops.1.color",
      "rect.border.width",
      "rect.border.color",
      "rect.border.alpha",
      "rect.cornerRadius.topLeft",
      "rect.cornerRadius.bottomRight",
    ]);
    expect(animation.tween["rect.height"].keyframes[0].delay).toBe(50);
    expect(animation.tween["rect.fill.stops.1.color"].initialValue).toEqual([
      1, 0, 0, 1,
    ]);
    expect(
      animation.tween["rect.fill.stops.1.color"].keyframes[0].value,
    ).toEqual([0, 0, 1, 1]);
  });

  it("expands a uniform corner radius timeline to every corner", () => {
    const [animation] = normalizeAnimations([
      {
        id: "round",
        targetId: "panel",
        type: "update",
        tween: {
          cornerRadius: {
            auto: { duration: 200, easing: "easeOutQuad" },
          },
        },
      },
    ]);

    expect(Object.keys(animation.tween)).toEqual([
      "rect.cornerRadius.topLeft",
      "rect.cornerRadius.topRight",
      "rect.cornerRadius.bottomRight",
      "rect.cornerRadius.bottomLeft",
    ]);
    expect(animation.tween["rect.cornerRadius.bottomLeft"].auto).toEqual({
      duration: 200,
      easing: "easeOutQuad",
    });
  });

  it.each([
    [
      "unknown fill field",
      { fill: { opacity: { auto: { duration: 100 } } } },
      "animations[0].tween.fill.opacity is not supported",
    ],
    [
      "unknown fill field with empty keyframes",
      { fill: { opacity: { keyframes: [] } } },
      "animations[0].tween.fill.opacity is not supported",
    ],
    [
      "unknown gradient point field",
      {
        fill: {
          start: {
            z: { auto: { duration: 100 } },
          },
        },
      },
      "animations[0].tween.fill.start.z is not supported",
    ],
    [
      "non-array stops",
      { fill: { stops: { index: 0 } } },
      "animations[0].tween.fill.stops must be a non-empty array",
    ],
    [
      "unknown border field",
      { border: { placement: { auto: { duration: 100 } } } },
      "animations[0].tween.border.placement is not supported",
    ],
    [
      "invalid stop index",
      {
        fill: {
          stops: [
            {
              index: -1,
              color: { auto: { duration: 100 } },
            },
          ],
        },
      },
      "index must be a non-negative integer",
    ],
    [
      "missing stop index beside an empty offset track",
      {
        fill: {
          stops: [{ offset: { keyframes: [] } }],
        },
      },
      "animations[0].tween.fill.stops[0].index must be a non-negative integer",
    ],
    [
      "non-integer stop index",
      {
        fill: {
          stops: [
            {
              index: 0.5,
              color: { auto: { duration: 100 } },
            },
          ],
        },
      },
      "index must be a non-negative integer",
    ],
    [
      "stop without an animated channel",
      {
        fill: {
          stops: [{ index: 0 }],
        },
      },
      "must define offset or color",
    ],
    [
      "duplicate stop index beside empty keyframes",
      {
        fill: {
          stops: [
            { index: 0, offset: { keyframes: [] } },
            { index: 0, color: { auto: { duration: 100 } } },
          ],
        },
      },
      "cannot target stop 0 twice",
    ],
    [
      "invalid color",
      {
        fill: {
          color: {
            keyframes: [{ duration: 100, value: "invalid()" }],
          },
        },
      },
      "must be a valid color",
    ],
    [
      "relative color",
      {
        border: {
          color: {
            keyframes: [{ duration: 100, value: "#ffffff", relative: true }],
          },
        },
      },
      "relative is not supported for colors",
    ],
    [
      "unknown corner",
      {
        cornerRadius: {
          upperLeft: { auto: { duration: 100 } },
        },
      },
      "animations[0].tween.cornerRadius.upperLeft is not supported",
    ],
    [
      "mixed uniform and per-corner timelines",
      {
        cornerRadius: {
          auto: { duration: 100 },
          topLeft: { auto: { duration: 100 } },
        },
      },
      "animations[0].tween.cornerRadius.topLeft is not supported",
    ],
  ])("rejects %s", (_name, tween, message) => {
    expect(() =>
      normalizeAnimations([
        {
          id: "invalid-rect",
          targetId: "panel",
          type: "update",
          tween,
        },
      ]),
    ).toThrow(message);
  });

  it.each([
    ["negative manual duration", { keyframes: [{ duration: -1, value: 1 }] }],
    [
      "fractional manual duration",
      { keyframes: [{ duration: 1.5, value: 1 }] },
    ],
    ["non-finite auto duration", { auto: { duration: Infinity } }],
    ["fractional auto duration", { auto: { duration: 0.5 } }],
    [
      "unsafe auto duration",
      { auto: { duration: Number.MAX_SAFE_INTEGER + 1 } },
    ],
  ])("rejects %s", (_name, x) => {
    expect(() =>
      normalizeAnimations([
        {
          id: "invalid-duration",
          targetId: "panel",
          type: "update",
          tween: { x },
        },
      ]),
    ).toThrow(/duration must be .*integer number of milliseconds/);
  });

  it("rejects fractional animation delays", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "fractional-delay",
          targetId: "panel",
          type: "update",
          tween: {
            x: { keyframes: [{ delay: 0.5, duration: 10, value: 1 }] },
          },
        },
      ]),
    ).toThrow(/delay must be .*integer number of milliseconds/);
  });

  it("rejects duplicate animation ids even when targets differ", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "duplicate",
          targetId: "first",
          type: "update",
          tween: { x: { auto: { duration: 100 } } },
        },
        {
          id: "duplicate",
          targetId: "second",
          type: "update",
          tween: { y: { auto: { duration: 100 } } },
        },
      ]),
    ).toThrow(/Animation ids must be unique/);
  });

  it("rejects more than one transition for the same target", () => {
    const transitionSide = {
      tween: {
        alpha: { keyframes: [{ duration: 100, value: 0 }] },
      },
    };

    expect(() =>
      normalizeAnimations([
        {
          id: "first-transition",
          targetId: "panel",
          type: "transition",
          prev: transitionSide,
        },
        {
          id: "second-transition",
          targetId: "panel",
          type: "transition",
          next: transitionSide,
        },
      ]),
    ).toThrow(/second transition for target "panel"/);
  });
});

describe("normalizeAnimations keyframe start values", () => {
  it("preserves scalar, shader-vector, and color start values", () => {
    const [animation] = normalizeAnimations([
      {
        id: "explicit-starts",
        targetId: "panel",
        type: "update",
        tween: {
          x: {
            keyframes: [{ startValue: 10, value: 20, duration: 100 }],
          },
          filters: {
            grade: {
              tint: {
                keyframes: [
                  {
                    startValue: [0.1, 0.2, 0.3],
                    value: [0.4, 0.5, 0.6],
                    duration: 100,
                  },
                ],
              },
            },
          },
          border: {
            color: {
              keyframes: [
                {
                  startValue: "#ff0000",
                  value: "#0000ff",
                  duration: 100,
                },
              ],
            },
          },
        },
      },
    ]);

    expect(animation.tween.x.keyframes[0].startValue).toBe(10);
    expect(animation.filterTweens.grade.tint.keyframes[0].startValue).toEqual([
      0.1, 0.2, 0.3,
    ]);
    expect(
      animation.tween["rect.border.color"].keyframes[0].startValue,
    ).toEqual([1, 0, 0, 1]);
  });

  it("validates start values through the same channel rules as endpoints", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "invalid-start",
          targetId: "panel",
          type: "update",
          tween: {
            filters: {
              grade: {
                tint: {
                  keyframes: [
                    { startValue: [1], value: [1, 1], duration: 100 },
                  ],
                },
              },
            },
          },
        },
      ]),
    ).toThrow(/startValue must be a finite number or a numeric array/);
  });
});

describe("normalizeAnimations empty track validation", () => {
  it.each([
    [
      "missing keyframes",
      { x: {} },
      /animations\[0\]\.tween\.x must define keyframes or auto/,
    ],
    [
      "keyframes and auto together",
      { x: { keyframes: [], auto: { duration: 100 } } },
      /animations\[0\]\.tween\.x cannot define both keyframes and auto/,
    ],
    [
      "invalid numeric initialValue",
      { x: { initialValue: "fast", keyframes: [] } },
      /animations\[0\]\.tween\.x\.initialValue must be a number/,
    ],
    [
      "non-object config",
      { x: null },
      /animations\[0\]\.tween\.x must be an object/,
    ],
    [
      "invalid color initialValue",
      { fill: { color: { initialValue: "invalid()", keyframes: [] } } },
      /animations\[0\]\.tween\.fill\.color\.initialValue must be a valid color/,
    ],
    [
      "invalid shader vector initialValue",
      {
        filters: {
          glow: { tint: { initialValue: [1], keyframes: [] } },
        },
      },
      /finite number or a numeric array with length 2, 3, 4, 9, or 16/,
    ],
    [
      "invalid filter progress initialValue",
      {
        filters: {
          glow: { progress: { initialValue: [0, 1], keyframes: [] } },
        },
      },
      /animations\[0\]\.tween\.filters\.glow\.progress\.initialValue must be a finite number/,
    ],
    [
      "missing filter parameter keyframes",
      { filters: { glow: { amount: {} } } },
      /animations\[0\]\.tween\.filters\.glow\.amount\.keyframes must be a non-empty array/,
    ],
  ])(
    "still validates authored shape before pruning: %s",
    (_name, tween, message) => {
      expect(() =>
        normalizeAnimations([
          { id: "invalid-empty", targetId: "panel", type: "update", tween },
        ]),
      ).toThrow(message);
    },
  );

  it("does not write a valid initialValue that accompanies empty keyframes", () => {
    const [animation] = normalizeAnimations([
      {
        id: "silent-initial",
        targetId: "panel",
        type: "update",
        tween: {
          x: { initialValue: 5, keyframes: [] },
          y: { initialValue: 0, keyframes: [{ value: 1, duration: 100 }] },
        },
      },
    ]);

    expect(animation.tween).toEqual({
      y: {
        initialValue: 0,
        keyframes: [{ value: 1, duration: 100, easing: "linear" }],
      },
    });
  });

  it("drops a filter track with a valid initialValue and empty keyframes", () => {
    expect(
      normalizeAnimations([
        {
          id: "silent-filter-initial",
          targetId: "panel",
          type: "update",
          tween: {
            filters: { glow: { amount: { initialValue: 0.5, keyframes: [] } } },
          },
        },
      ]),
    ).toEqual([]);
  });

  it.each([
    [
      "unsupported ordinary property",
      { bogus: { keyframes: [] } },
      /animations\[0\]\.tween\.bogus is not a supported animation property/,
    ],
    [
      "reserved shader clock",
      { filters: { glow: { uTime: { keyframes: [] } } } },
      /uTime is read-only/,
    ],
    [
      "legacy shader progress",
      { filters: { glow: { uProgress: { keyframes: [] } } } },
      /uProgress is no longer supported/,
    ],
    [
      "invalid shader parameter key",
      { filters: { glow: { "edge-width": { keyframes: [] } } } },
      /must be progress or match/,
    ],
  ])("still rejects %s on empty tracks", (_name, tween, message) => {
    expect(() =>
      normalizeAnimations([
        { id: "invalid-empty", targetId: "panel", type: "update", tween },
      ]),
    ).toThrow(message);
  });

  it("still rejects transition-only properties on empty side tracks", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "bad-side-property",
          targetId: "panel",
          type: "transition",
          prev: { tween: { blurX: { keyframes: [] } } },
          next: {
            tween: { alpha: { keyframes: [{ value: 1, duration: 100 }] } },
          },
        },
      ]),
    ).toThrow(/prev\.tween\.blurX is not a supported animation property/);
  });

  it("keeps auto timelines and their conflicts unchanged", () => {
    const [animation] = normalizeAnimations([
      {
        id: "auto-kept",
        targetId: "panel",
        type: "update",
        tween: { x: { auto: { duration: 100 } } },
      },
    ]);
    expect(animation.tween.x.auto).toEqual({ duration: 100, easing: "linear" });

    expect(() =>
      normalizeAnimations([
        {
          id: "auto-initial",
          targetId: "panel",
          type: "update",
          tween: { x: { auto: { duration: 100 }, initialValue: 5 } },
        },
      ]),
    ).toThrow(/initialValue is not valid when auto is defined/);
  });
});

describe("normalizeAnimations alias conflicts on empty tracks", () => {
  it.each([
    [
      "one empty track",
      {
        x: { keyframes: [] },
        translateX: { keyframes: [{ value: 1, duration: 100 }] },
      },
    ],
    [
      "both empty tracks",
      { x: { keyframes: [] }, translateX: { keyframes: [] } },
    ],
    [
      "empty track beside auto",
      { y: { keyframes: [] }, translateY: { auto: { duration: 100 } } },
    ],
  ])("rejects update %s", (_name, tween) => {
    expect(() =>
      normalizeAnimations([
        { id: "alias", targetId: "panel", type: "update", tween },
      ]),
    ).toThrow(/cannot define both/);
  });

  it("rejects transition side alias conflicts when one track is empty", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "side-alias",
          targetId: "panel",
          type: "transition",
          prev: {
            tween: {
              x: { keyframes: [] },
              translateX: { keyframes: [] },
            },
          },
          next: {
            tween: { alpha: { keyframes: [{ value: 1, duration: 100 }] } },
          },
        },
      ]),
    ).toThrow("animations[0].prev.tween cannot define both x and translateX.");
  });
});

describe("normalizeAnimations independent non-empty contracts", () => {
  it("still rejects empty mask progress keyframes", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "empty-mask-progress",
          targetId: "scene",
          type: "transition",
          mask: [
            {
              kind: "single",
              texture: "wipe",
              progress: { keyframes: [] },
            },
          ],
        },
      ]),
    ).toThrow(
      "animations[0].mask[0].progress.keyframes must be a non-empty array.",
    );
  });

  it("still rejects an invalid mask progress initialValue before emptiness", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "bad-mask-progress-initial",
          targetId: "scene",
          type: "transition",
          mask: [
            {
              kind: "single",
              texture: "wipe",
              progress: { initialValue: "half", keyframes: [] },
            },
          ],
        },
      ]),
    ).toThrow("animations[0].mask[0].progress.initialValue must be a number.");
  });

  it("still injects default mask progress for masks without one", () => {
    const [animation] = normalizeAnimations([
      {
        id: "default-mask-progress",
        targetId: "scene",
        type: "transition",
        mask: [{ kind: "single", texture: "wipe" }],
      },
    ]);

    expect(animation.mask[0].progress).toEqual({
      initialValue: 0,
      keyframes: [{ duration: 0, value: 1, easing: "linear" }],
    });
  });

  it("still rejects empty sequence mask frames", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "empty-mask-frames",
          targetId: "scene",
          type: "transition",
          mask: [{ kind: "sequence", frames: [] }],
        },
      ]),
    ).toThrow(
      "animations[0].mask[0].frames must be an array with at least two frames.",
    );
  });

  it("still rejects empty compositor tween maps and keyframes", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "empty-compositor-map",
          targetId: "scene",
          type: "transition",
          compositor: createCompositor({ tween: {} }),
        },
      ]),
    ).toThrow(
      "animations[0].compositor.tween must define at least one parameter.",
    );

    expect(() =>
      normalizeAnimations([
        {
          id: "empty-compositor-param",
          targetId: "scene",
          type: "transition",
          compositor: createCompositor({
            tween: {
              ...progressTween,
              edgeWidth: { keyframes: [] },
            },
          }),
        },
      ]),
    ).toThrow(
      "animations[0].compositor.tween.edgeWidth.keyframes must be a non-empty array.",
    );

    expect(() =>
      normalizeAnimations([
        {
          id: "empty-compositor-progress",
          targetId: "scene",
          type: "transition",
          compositor: createCompositor({
            tween: { progress: { keyframes: [] } },
          }),
        },
      ]),
    ).toThrow(
      "animations[0].compositor.tween.progress.keyframes must be a non-empty array.",
    );
  });

  it("still rejects empty gsap step arrays", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "empty-gsap",
          targetId: "scene",
          type: "update",
          gsap: {
            profile: "portable-v1",
            targets: { panel: { element: "panel" } },
            steps: [],
          },
        },
      ]),
    ).toThrow("animations[0].gsap.steps must be a non-empty array.");
  });
});

describe("normalizeAnimations pruned animation bookkeeping", () => {
  it("reports authored indexes for duplicate ids after empty animations drop", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "dropped",
          targetId: "panel",
          type: "update",
          tween: { x: { keyframes: [] } },
        },
        {
          id: "dup",
          targetId: "first",
          type: "update",
          tween: { x: { auto: { duration: 100 } } },
        },
        {
          id: "dup",
          targetId: "second",
          type: "update",
          tween: { y: { auto: { duration: 100 } } },
        },
      ]),
    ).toThrow(
      'animations[2].id duplicates animations[1].id "dup". Animation ids must be unique within one state.',
    );
  });

  it.each([
    [
      "dropped duplicate first",
      [
        {
          id: "dup",
          targetId: "first",
          type: "update",
          tween: { x: { keyframes: [] } },
        },
        {
          id: "dup",
          targetId: "second",
          type: "update",
          tween: { y: { auto: { duration: 100 } } },
        },
      ],
    ],
    [
      "dropped duplicate second",
      [
        {
          id: "dup",
          targetId: "first",
          type: "update",
          tween: { y: { auto: { duration: 100 } } },
        },
        {
          id: "dup",
          targetId: "second",
          type: "update",
          tween: { x: { keyframes: [] } },
        },
      ],
    ],
  ])(
    "ignores duplicate ids when one duplicate fully drops: %s",
    (_name, animations) => {
      expect(normalizeAnimations(animations)).toEqual([
        {
          id: "dup",
          targetId: expect.any(String),
          type: "update",
          tween: { y: { auto: { duration: 100, easing: "linear" } } },
        },
      ]);
    },
  );

  it("reports authored indexes for duplicate transition targets after pruning", () => {
    const transitionSide = {
      tween: { alpha: { keyframes: [{ duration: 100, value: 0 }] } },
    };

    expect(() =>
      normalizeAnimations([
        {
          id: "dropped-update",
          targetId: "panel",
          type: "update",
          tween: {},
        },
        {
          id: "first-transition",
          targetId: "panel",
          type: "transition",
          prev: transitionSide,
        },
        {
          id: "second-transition",
          targetId: "panel",
          type: "transition",
          next: transitionSide,
        },
      ]),
    ).toThrow(
      'animations[2] defines a second transition for target "panel"; animations[1] already owns that transition target.',
    );
  });

  it("allows a fully dropped update beside a transition for the same target", () => {
    expect(
      normalizeAnimations([
        {
          id: "dropped-update",
          targetId: "panel",
          type: "update",
          tween: { x: { keyframes: [] } },
        },
        {
          id: "kept-transition",
          targetId: "panel",
          type: "transition",
          prev: {
            tween: { alpha: { keyframes: [{ duration: 100, value: 0 }] } },
          },
        },
      ]),
    ).toEqual([
      {
        id: "kept-transition",
        targetId: "panel",
        type: "transition",
        prev: {
          tween: {
            alpha: {
              keyframes: [{ duration: 100, value: 0, easing: "linear" }],
            },
          },
        },
      },
    ]);
  });

  it("still rejects surviving mixed update and transition types for one target", () => {
    expect(() =>
      normalizeAnimations([
        {
          id: "kept-update",
          targetId: "panel",
          type: "update",
          tween: { x: { auto: { duration: 100 } } },
        },
        {
          id: "kept-transition",
          targetId: "panel",
          type: "transition",
          prev: {
            tween: { alpha: { keyframes: [{ duration: 100, value: 0 }] } },
          },
        },
      ]),
    ).toThrow(
      'Animations targeting "panel" cannot mix update and transition types in the same state.',
    );
  });

  it("ignores filter channel conflicts when one side fully drops", () => {
    expect(
      normalizeAnimations([
        {
          id: "kept-channel",
          targetId: "scene",
          type: "update",
          tween: {
            filters: {
              glow: { amount: { keyframes: [{ duration: 100, value: 1 }] } },
            },
          },
        },
        {
          id: "dropped-channel",
          targetId: "scene",
          type: "update",
          tween: {
            filters: { glow: { amount: { keyframes: [] } } },
          },
        },
      ]),
    ).toHaveLength(1);
  });
});

describe("normalizeAnimations input immutability", () => {
  it("does not mutate authored animations while pruning empty tracks", () => {
    const input = [
      {
        id: "immutable",
        targetId: "panel",
        type: "update",
        playback: { speed: 2 },
        tween: {
          x: { keyframes: [] },
          y: { initialValue: 0, keyframes: [{ value: 10, duration: 100 }] },
          fill: {
            color: { keyframes: [{ value: "#00ff00", duration: 100 }] },
            stops: [],
          },
          filters: {
            glow: { tint: { initialValue: [1, 0, 0], keyframes: [] } },
            grade: {
              amount: {
                keyframes: [{ value: [0.2, 0.4], duration: 100 }],
              },
            },
          },
        },
      },
    ];
    const snapshot = structuredClone(input);
    const [animation] = normalizeAnimations(input);

    expect(input).toEqual(snapshot);
    expect(animation.tween.y.keyframes).not.toBe(input[0].tween.y.keyframes);
    expect(animation.filterTweens.grade.amount.keyframes[0].value).not.toBe(
      input[0].tween.filters.grade.amount.keyframes[0].value,
    );
    expect(Object.keys(animation.filterTweens)).toEqual(["grade"]);
  });
});
