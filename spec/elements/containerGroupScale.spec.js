import { Container, Texture } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { createAnimationBus } from "../../src/plugins/animations/animationBus.js";
import {
  buildAnimationContinuityPlan,
  getAnimationContinuitySignature,
} from "../../src/plugins/animations/planAnimations.js";
import { containerPlugin } from "../../src/plugins/elements/container/index.js";
import { getContainerChildAnimations } from "../../src/plugins/elements/container/util/liveContainerScale.js";
import { rectPlugin } from "../../src/plugins/elements/rect/index.js";
import { renderElements } from "../../src/plugins/elements/renderElements.js";
import { refreshElementPivot } from "../../src/plugins/elements/util/transform.js";
import { createCompletionTracker } from "../../src/util/completionTracker.js";
import { hitTestElementBounds } from "../../src/util/hitTestElementBounds.js";
import { normalizeAnimations } from "../../src/util/normalizeAnimations.js";
import { parseContainerForTesting } from "../support/parseContainer.js";

const elementPlugins = [containerPlugin, rectPlugin];

const renderTree = (computed) => {
  const stage = new Container();

  renderElements({
    app: { renderer: { width: 1280, height: 720 } },
    parent: stage,
    prevComputedTree: [],
    nextComputedTree: [computed],
    animations: [],
    animationBus: { dispatch: vi.fn() },
    completionTracker: {
      getVersion: () => 0,
      track: vi.fn(),
      complete: vi.fn(),
    },
    eventHandler: vi.fn(),
    elementPlugins,
    signal: new AbortController().signal,
  });

  return stage;
};

const findByLabel = (root, label) => {
  if (root.label === label) return root;

  for (const child of root.children ?? []) {
    const found = findByLabel(child, label);
    if (found) return found;
  }

  return undefined;
};

const roundedBounds = (stage, id) => {
  const bounds = findByLabel(stage, id).getBounds();

  return {
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.round(bounds.width),
    height: Math.round(bounds.height),
  };
};

const rect = (id, x, y, width, height, overrides = {}) => ({
  id,
  type: "rect",
  x,
  y,
  width,
  height,
  fill: "#FFFFFF",
  ...overrides,
});

// A screen-sized canvas anchored at the screen centre, like a layout visual.
const canvas = (overrides = {}) => ({
  id: "canvas",
  type: "container",
  x: 640,
  y: 360,
  width: 1280,
  height: 720,
  anchorX: 0.5,
  anchorY: 0.5,
  children: [
    rect("top-left", 80, 80, 320, 180),
    rect("bottom-right", 880, 520, 320, 180),
  ],
  ...overrides,
});

// Renders the container unscaled, then scales the live Pixi container the way
// an update tween does when it reaches its last keyframe.
const renderLiveScaled = (state, scaleX, scaleY) => {
  const stage = renderTree(
    parseContainerForTesting({ state: { ...state, scaleX: 1, scaleY: 1 } }),
  );
  const container = findByLabel(stage, state.id);

  container.scale.set(scaleX, scaleY);
  refreshElementPivot(container);

  return stage;
};

const renderParsedScaled = (state, scaleX, scaleY) =>
  renderTree(parseContainerForTesting({ state: { ...state, scaleX, scaleY } }));

const expectSameBounds = (actualStage, expectedStage, ids) => {
  for (const id of ids) {
    const actual = roundedBounds(actualStage, id);
    const expected = roundedBounds(expectedStage, id);

    for (const field of ["x", "y", "width", "height"]) {
      expect(
        Math.abs(actual[field] - expected[field]),
        `${id}.${field}: ${actual[field]} vs ${expected[field]}`,
      ).toBeLessThanOrEqual(1);
    }
  }
};

describe("container group scale", () => {
  it("scales a screen-sized canvas around its anchor as one group", () => {
    const stage = renderParsedScaled(canvas(), 0.5, 0.5);

    expect(roundedBounds(stage, "top-left")).toEqual({
      x: 360,
      y: 220,
      width: 160,
      height: 90,
    });
    expect(roundedBounds(stage, "bottom-right")).toEqual({
      x: 760,
      y: 440,
      width: 160,
      height: 90,
    });
  });

  it("bakes the scale into child positions and the container size", () => {
    const result = parseContainerForTesting({
      state: {
        id: "group",
        type: "container",
        x: 0,
        y: 0,
        scaleX: 2,
        scaleY: 0.5,
        children: [rect("child", 10, 20, 30, 40)],
      },
    });

    expect(result).toMatchObject({ width: 80, height: 30, x: 0, y: 0 });
    expect(result.children[0]).toMatchObject({
      x: 20,
      y: 10,
      width: 60,
      height: 20,
    });
  });

  it("uses the scaled size for the anchor offset and default origin", () => {
    const result = parseContainerForTesting({
      state: canvas({ scaleX: 0.5, scaleY: 0.5 }),
    });

    expect(result).toMatchObject({
      width: 640,
      height: 360,
      x: 320,
      y: 180,
      originX: 320,
      originY: 180,
    });
  });

  it.each([
    ["shrink", 0.5, 0.5],
    ["grow", 2, 2],
    ["non-uniform", 1.5, 0.75],
    ["mirror", -1.5, 0.75],
  ])(
    "ends a %s scale tween exactly on the parsed layout",
    (_name, scaleX, scaleY) => {
      const state = canvas({ rotation: 30 });

      expectSameBounds(
        renderParsedScaled(state, scaleX, scaleY),
        renderLiveScaled(state, scaleX, scaleY),
        ["top-left", "bottom-right"],
      );
    },
  );

  it("composes nested containers, child origins and child rotation", () => {
    const state = {
      id: "outer",
      type: "container",
      x: 400,
      y: 300,
      anchorX: 0.5,
      anchorY: 0.5,
      children: [
        rect("outer-rect", 0, 0, 100, 60),
        {
          id: "inner",
          type: "container",
          x: 200,
          y: 120,
          scaleX: 0.5,
          scaleY: 2,
          rotation: 15,
          children: [
            rect("inner-a", 10, 20, 80, 40),
            rect("inner-b", 120, 0, 40, 40, {
              originX: 20,
              originY: 20,
              rotation: 45,
            }),
          ],
        },
      ],
    };

    expectSameBounds(
      renderParsedScaled(state, 0.5, 0.5),
      renderLiveScaled(state, 0.5, 0.5),
      ["outer-rect", "inner-a", "inner-b"],
    );
  });

  it.each(["horizontal", "vertical"])(
    "scales %s flow gaps and the wrap size with the group",
    (direction) => {
      const state = {
        id: "flow",
        type: "container",
        x: 100,
        y: 100,
        width: 250,
        height: 250,
        direction,
        gapX: 20,
        gapY: 30,
        children: [
          rect("flow-a", 0, 0, 100, 80),
          rect("flow-b", 0, 0, 100, 80),
          rect("flow-c", 0, 0, 100, 80),
        ],
      };

      expectSameBounds(
        renderParsedScaled(state, 0.5, 0.5),
        renderLiveScaled(state, 0.5, 0.5),
        ["flow-a", "flow-b", "flow-c"],
      );

      // The third child wraps at scale 1, so it must also wrap at scale 0.5.
      const parsed = parseContainerForTesting({
        state: { ...state, scaleX: 0.5, scaleY: 0.5 },
      });
      const [, , third] = parsed.children;
      expect(direction === "horizontal" ? third.x : third.y).toBe(0);
    },
  );

  it("collapses the group to its anchor point at zero scale", () => {
    const state = canvas({ scaleX: 0, scaleY: 0 });
    const result = parseContainerForTesting({ state });

    // The renderer applies the zero scale, so the geometry stays unscaled and a
    // tween can grow the group again.
    expect(result).toMatchObject({
      width: 1280,
      height: 720,
      x: 0,
      y: 0,
      originX: 640,
      originY: 360,
      scaleX: 0,
      scaleY: 0,
    });
    expect(result.children[0]).toMatchObject({
      x: 80,
      y: 80,
      width: 320,
      height: 180,
    });

    const stage = renderTree(result);
    for (const id of ["top-left", "bottom-right"]) {
      expect(roundedBounds(stage, id)).toEqual({
        x: 640,
        y: 360,
        width: 0,
        height: 0,
      });
    }
  });

  it("bakes a zero-scale container nested in a scaled group at the inherited scale", () => {
    const result = parseContainerForTesting({
      state: {
        id: "outer",
        type: "container",
        x: 0,
        y: 0,
        scaleX: 0.5,
        scaleY: 2,
        children: [
          {
            id: "inner",
            type: "container",
            x: 100,
            y: 100,
            scaleX: 0,
            scaleY: 0,
            children: [rect("inner-rect", 10, 10, 40, 40)],
          },
        ],
      },
    });
    const [inner] = result.children;

    expect(inner).toMatchObject({
      scaleX: 0,
      scaleY: 0,
      inheritedScaleX: 0.5,
      inheritedScaleY: 2,
    });
    expect(inner.children[0]).toMatchObject({
      x: 5,
      y: 20,
      width: 20,
      height: 80,
    });
  });

  it.each(["horizontal", "vertical"])(
    "gives a collapsed container no space in a %s flow, like a collapsed rect",
    (direction) => {
      const flow = (collapsed) =>
        parseContainerForTesting({
          state: {
            id: "flow",
            type: "container",
            direction,
            gapX: 10,
            gapY: 10,
            children: [
              rect("a", 0, 0, 100, 100),
              collapsed,
              rect("b", 0, 0, 100, 100),
            ],
          },
        });
      const withContainer = flow({
        id: "collapsed",
        type: "container",
        scaleX: 0,
        scaleY: 0,
        children: [rect("inner", 0, 0, 100, 100)],
      });
      const withRect = flow(
        rect("collapsed", 0, 0, 100, 100, { scaleX: 0, scaleY: 0 }),
      );
      const [axis, size] =
        direction === "horizontal" ? ["x", "width"] : ["y", "height"];

      expect(withContainer.children[2][axis]).toBe(120);
      expect(withContainer[size]).toBe(220);
      expect(withRect.children[2][axis]).toBe(120);
      expect(withRect[size]).toBe(220);
      // Its own geometry is kept, so a tween can grow it again.
      expect(withContainer.children[1]).toMatchObject({
        width: 100,
        height: 100,
      });
    },
  );

  it("sizes a parent up to the point a collapsed container collapses to", () => {
    const parent = parseContainerForTesting({
      state: {
        id: "parent",
        type: "container",
        children: [
          rect("a", 0, 0, 100, 100),
          {
            id: "collapsed",
            type: "container",
            x: 300,
            y: 200,
            anchorX: 0.5,
            anchorY: 0.5,
            scaleX: 0,
            scaleY: 0,
            children: [rect("inner", 0, 0, 400, 400)],
          },
        ],
      },
    });

    expect(parent).toMatchObject({ width: 300, height: 200 });
  });

  it("keeps an explicit container origin in rendered pixels like other elements", () => {
    const result = parseContainerForTesting({
      state: canvas({ scaleX: 0.5, scaleY: 0.5, originX: 100, originY: 50 }),
    });

    expect(result).toMatchObject({ x: 320, y: 180, originX: 100, originY: 50 });
  });

  it("scales scrollbar sizes with the group", () => {
    const result = parseContainerForTesting({
      state: {
        id: "scroller",
        type: "container",
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        scroll: true,
        scaleX: 0.5,
        scaleY: 2,
        scrollbar: {
          vertical: {
            thickness: 20,
            track: { src: "track" },
            thumb: { src: "thumb", length: 30 },
            startButton: { src: "up", size: 10, step: 40 },
            endButton: { src: "down", size: 12 },
          },
        },
        children: [rect("row", 0, 0, 200, 300)],
      },
    });

    expect(result).toMatchObject({ width: 100, height: 200 });
    expect(result.scrollbar.vertical).toMatchObject({
      thickness: 10,
      thumb: { src: "thumb", length: 60 },
      startButton: { src: "up", size: 20, step: 80 },
      endButton: { src: "down", size: 24 },
    });
  });

  it("scales a scrollbar button's default size and step along the scrollbar", () => {
    const scroller = (scaleX, scaleY) =>
      parseContainerForTesting({
        state: {
          id: "scroller",
          type: "container",
          x: 0,
          y: 0,
          width: 200,
          height: 100,
          scroll: true,
          scaleX,
          scaleY,
          scrollbar: {
            vertical: {
              thickness: 20,
              track: { src: "track" },
              thumb: { src: "thumb" },
              startButton: { src: "up" },
            },
          },
          children: [rect("row", 0, 0, 200, 300)],
        },
      }).scrollbar.vertical;

    // A button without a size is as long as the scrollbar is thick, and
    // without a step it scrolls 24 units.
    expect(scroller(0.5, 2)).toMatchObject({
      thickness: 10,
      startButton: { src: "up", size: 40, step: 48 },
    });
    // Under a uniform scale the thickness fallback is already scaled.
    expect(scroller(2, 2).startButton).toEqual({ src: "up", step: 48 });
    expect(scroller(1, 1).startButton).toEqual({ src: "up" });
  });

  it("hit-tests a clickable child where the scaled group draws it", () => {
    const state = canvas({
      scaleX: 0.5,
      scaleY: 0.5,
      children: [
        rect("button", 80, 80, 320, 180, {
          click: { payload: { id: "button" } },
        }),
      ],
    });
    const computed = parseContainerForTesting({ state });
    const stage = renderTree(computed);
    // The deepest element on each hit path.
    const hitIds = (x, y) =>
      hitTestElementBounds({ stage, elements: [computed], x, y }).map(
        (hit) => hit.path.at(-1).id,
      );

    // Inside the drawn button at (360, 220)-(520, 310).
    expect(hitIds(440, 265)).toContain("button");
    // Where the button was authored, now outside the scaled group's button.
    expect(hitIds(120, 120)).not.toContain("button");
  });

  it("sizes a clickable container's hit area to its scaled canvas", () => {
    const stage = renderParsedScaled(
      canvas({ click: { payload: { id: "canvas" } } }),
      0.5,
      0.5,
    );
    const container = findByLabel(stage, "canvas");

    expect(container.hitArea).toMatchObject({
      x: 0,
      y: 0,
      width: 640,
      height: 360,
    });
  });

  describe("scale tweens", () => {
    const linear = (value, duration = 1000) => ({
      duration,
      value,
      easing: "linear",
    });
    const scaleTween = (track) => [
      {
        id: "scale-tween",
        targetId: "canvas",
        type: "update",
        tween: { scaleX: track, scaleY: track },
      },
    ];
    const createRun = () => {
      const stage = new Container();
      const animationBus = createAnimationBus();
      const render = (prev, next, animations = []) =>
        renderElements({
          app: { render: vi.fn(), renderer: { width: 1280, height: 720 } },
          parent: stage,
          prevComputedTree: prev,
          nextComputedTree: next,
          // RouteGraphics normalizes animations before rendering.
          animations: normalizeAnimations(animations),
          animationBus,
          completionTracker: createCompletionTracker(),
          eventHandler: vi.fn(),
          elementPlugins,
          signal: new AbortController().signal,
        });

      return { stage, animationBus, render };
    };
    const parsedCanvas = (scale) =>
      parseContainerForTesting({
        state: canvas({ scaleX: scale, scaleY: scale }),
      });
    // What the canvas looks like when it is drawn statically at this scale.
    const staticStage = (scale) => renderTree(parsedCanvas(scale));
    const ids = ["top-left", "bottom-right"];

    it.each([
      ["shrinks", 1, 0.5, { keyframes: [linear(0.5)] }, 0.75],
      ["grows from a scaled state", 0.5, 1, { keyframes: [linear(1)] }, 0.75],
      [
        "shrinks from a scaled state",
        0.5,
        0.25,
        { keyframes: [linear(0.25)] },
        0.375,
      ],
      ["grows from zero", 0, 1, { keyframes: [linear(1)] }, 0.5],
      ["collapses to zero", 1, 0, { keyframes: [linear(0)] }, 0.5],
      ["runs an Auto tween", 0.5, 1, { auto: { duration: 1000 } }, 0.75],
      [
        "pulses and settles",
        0.5,
        0.5,
        { keyframes: [linear(0.6, 500), linear(0.5, 500)] },
        0.6,
      ],
    ])(
      "%s with the authored scale on every frame",
      async (_name, from, to, track, midScale) => {
        const { stage, animationBus, render } = createRun();
        await render([], [parsedCanvas(from)]);
        const operation = render(
          [parsedCanvas(from)],
          [parsedCanvas(to)],
          scaleTween(track),
        );

        animationBus.tick(500);
        expectSameBounds(stage, staticStage(midScale), ids);

        animationBus.tick(500);
        await operation;
        expectSameBounds(stage, staticStage(to), ids);
      },
    );

    it("pops a newly added scaled container in from zero", async () => {
      const { stage, animationBus, render } = createRun();
      const operation = render(
        [],
        [parsedCanvas(0.5)],
        scaleTween({ initialValue: 0, keyframes: [linear(0.5)] }),
      );

      animationBus.tick(500);
      expectSameBounds(stage, staticStage(0.25), ids);

      animationBus.tick(500);
      await operation;
      expectSameBounds(stage, staticStage(0.5), ids);
    });

    it("tweens a container nested in a scaled group by its own scale", async () => {
      const outer = (innerScale) =>
        parseContainerForTesting({
          state: {
            id: "outer",
            type: "container",
            x: 0,
            y: 0,
            scaleX: 0.5,
            scaleY: 0.5,
            children: [canvas({ scaleX: innerScale, scaleY: innerScale })],
          },
        });
      const { stage, animationBus, render } = createRun();
      await render([], [outer(1)]);
      const operation = render(
        [outer(1)],
        [outer(0.5)],
        scaleTween({ keyframes: [linear(0.5)] }),
      );

      animationBus.tick(500);
      expectSameBounds(stage, renderTree(outer(0.75)), ids);

      animationBus.tick(500);
      await operation;
      expectSameBounds(stage, renderTree(outer(0.5)), ids);
    });

    it("ends a nested scale tween on the next layout when the parent's scale changes too", async () => {
      const outer = (outerScale, innerScale) =>
        parseContainerForTesting({
          state: {
            id: "outer",
            type: "container",
            x: 0,
            y: 0,
            scaleX: outerScale,
            scaleY: outerScale,
            children: [canvas({ scaleX: innerScale, scaleY: innerScale })],
          },
        });
      const { stage, animationBus, render } = createRun();
      await render([], [outer(0.5, 1)]);
      const operation = render(
        [outer(0.5, 1)],
        [outer(1, 0.5)],
        scaleTween({ keyframes: [linear(0.5)] }),
      );

      // The last tween frame already has the next layout's size, so the render
      // that follows does not resize the group. Its position, which this
      // update does not tween, moves on completion like any other property.
      animationBus.tick(999);
      const expected = renderTree(outer(1, 0.5));
      for (const id of ids) {
        const actual = roundedBounds(stage, id);
        const target = roundedBounds(expected, id);
        expect(Math.abs(actual.width - target.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(actual.height - target.height)).toBeLessThanOrEqual(1);
      }

      animationBus.tick(1);
      await operation;
      expectSameBounds(stage, renderTree(outer(1, 0.5)), ids);
    });

    it.each([
      ["grows", 0.5, 1],
      ["shrinks", 1, 0.5],
    ])(
      "%s the base of a scale loop with the authored scale on every frame",
      async (_name, from, to) => {
        const { stage, animationBus, render } = createRun();
        await render([], [parsedCanvas(from)]);
        render(
          [parsedCanvas(from)],
          [parsedCanvas(to)],
          [
            {
              ...scaleTween({
                keyframes: [linear(to * 1.2, 500), linear(to, 500)],
              })[0],
              playback: { loop: true },
            },
          ],
        );

        // A loop never completes, so the next state is drawn before it starts.
        expectSameBounds(stage, staticStage(to), ids);
        animationBus.tick(500);
        expectSameBounds(stage, staticStage(to * 1.2), ids);
        animationBus.tick(500);
        expectSameBounds(stage, staticStage(to), ids);
        animationBus.tick(250);
        expectSameBounds(stage, staticStage(to * 1.1), ids);
      },
    );

    it("continues a persistent scale loop on a scaled container across renders", () => {
      const { animationBus, render } = createRun();
      const pulse = {
        ...scaleTween({ keyframes: [linear(0.6, 500), linear(0.5, 500)] })[0],
        playback: { continuity: "persistent", loop: true },
      };
      const state = {
        elements: [parsedCanvas(0.5)],
        animations: normalizeAnimations([pulse]),
      };

      render([], state.elements, [pulse]);
      animationBus.tick(200);

      const plan = buildAnimationContinuityPlan({
        prevState: state,
        nextState: state,
        activeAnimations: animationBus.getContinuableAnimations(),
      });

      expect(plan.continuedAnimationIds.has(pulse.id)).toBe(true);
    });
  });

  describe("child tweens", () => {
    const linear = (value, duration = 1000) => ({
      duration,
      value,
      easing: "linear",
    });
    const createRun = () => {
      const stage = new Container();
      const animationBus = createAnimationBus();
      const render = (prev, next, animations = []) =>
        renderElements({
          app: { render: vi.fn(), renderer: { width: 1280, height: 720 } },
          parent: stage,
          prevComputedTree: prev,
          nextComputedTree: next,
          // RouteGraphics normalizes animations before rendering.
          animations: normalizeAnimations(animations),
          animationBus,
          completionTracker: createCompletionTracker(),
          eventHandler: vi.fn(),
          elementPlugins,
          signal: new AbortController().signal,
        });

      return { stage, animationBus, render };
    };
    const ids = ["top-left", "bottom-right"];
    const canvasAt = (scale, topLeft, overrides = {}) =>
      canvas({
        scaleX: scale,
        scaleY: scale,
        children: [topLeft, rect("bottom-right", 880, 520, 320, 180)],
        ...overrides,
      });
    const parsed = (state) => parseContainerForTesting({ state });
    const topLeftTween = {
      id: "top-left-tween",
      targetId: "top-left",
      type: "update",
      tween: {
        x: { keyframes: [linear(400)] },
        y: {
          keyframes: [{ ...linear(80), relative: true }],
        },
        width: { keyframes: [linear(160)] },
        height: { initialValue: 90, keyframes: [linear(360)] },
      },
    };

    it("moves and resizes a child in the container's unscaled units", async () => {
      const from = parsed(canvasAt(0.5, rect("top-left", 80, 80, 320, 180)));
      const to = parsed(canvasAt(0.5, rect("top-left", 400, 160, 160, 360)));
      const { stage, animationBus, render } = createRun();
      await render([], [from]);
      const operation = render([from], [to], [topLeftTween]);

      animationBus.tick(500);
      expectSameBounds(
        stage,
        renderTree(parsed(canvasAt(0.5, rect("top-left", 240, 120, 240, 225)))),
        ids,
      );

      animationBus.tick(500);
      await operation;
      expectSameBounds(stage, renderTree(to), ids);
    });

    it("converts a grandchild's tween by the scale of every ancestor", async () => {
      const outer = (topLeft) =>
        parsed({
          id: "outer",
          type: "container",
          x: 0,
          y: 0,
          scaleX: 0.5,
          scaleY: 0.5,
          children: [canvasAt(1, topLeft)],
        });
      const from = outer(rect("top-left", 80, 80, 320, 180));
      const to = outer(rect("top-left", 400, 160, 160, 360));
      const { stage, animationBus, render } = createRun();
      await render([], [from]);
      const operation = render([from], [to], [topLeftTween]);

      animationBus.tick(500);
      expectSameBounds(
        stage,
        renderTree(outer(rect("top-left", 240, 120, 240, 225))),
        ids,
      );

      animationBus.tick(500);
      await operation;
      expectSameBounds(stage, renderTree(to), ids);
    });

    it("moves a container nested in a scaled group in its parent's units", async () => {
      const outer = (x) =>
        parsed({
          id: "outer",
          type: "container",
          x: 0,
          y: 0,
          scaleX: 0.5,
          scaleY: 0.5,
          children: [canvasAt(1, rect("top-left", 80, 80, 320, 180), { x })],
        });
      const { stage, animationBus, render } = createRun();
      await render([], [outer(640)]);
      const operation = render(
        [outer(640)],
        [outer(960)],
        [
          {
            id: "canvas-move",
            targetId: "canvas",
            type: "update",
            tween: { x: { keyframes: [linear(960)] } },
          },
        ],
      );

      animationBus.tick(500);
      expectSameBounds(stage, renderTree(outer(800)), ids);

      animationBus.tick(500);
      await operation;
      expectSameBounds(stage, renderTree(outer(960)), ids);
    });

    it("slides a removed child out in the container's unscaled units, like an added one in", async () => {
      const stage = new Container();
      const animationBus = createAnimationBus();
      const render = (prev, next, animations = []) =>
        renderElements({
          app: {
            render: vi.fn(),
            renderer: {
              width: 1280,
              height: 720,
              generateTexture: vi.fn(() => Texture.WHITE),
            },
          },
          parent: stage,
          prevComputedTree: prev,
          nextComputedTree: next,
          animations: normalizeAnimations(animations),
          animationBus,
          completionTracker: createCompletionTracker(),
          eventHandler: vi.fn(),
          elementPlugins,
          signal: new AbortController().signal,
        });
      const group = (children) =>
        parsed({
          id: "group",
          type: "container",
          x: 0,
          y: 0,
          scaleX: 0.5,
          scaleY: 0.5,
          children,
        });
      const slide = (side, value, initialValue) => ({
        type: "transition",
        [side]: {
          tween: {
            x: {
              initialValue,
              keyframes: [linear(value)],
            },
          },
        },
      });
      const before = group([
        rect("stay", 0, 0, 100, 100),
        rect("leaving", 200, 0, 100, 100),
      ]);
      const after = group([
        rect("stay", 0, 0, 100, 100),
        rect("entering", 200, 200, 100, 100),
      ]);

      await render([], [before]);
      render(
        [before],
        [after],
        [
          { id: "exit", targetId: "leaving", ...slide("prev", 800) },
          { id: "entry", targetId: "entering", ...slide("next", 200, 800) },
        ],
      );
      animationBus.tick(500);

      // Each transition draws its subject through an unlabelled surface whose
      // first child carries the tweened x. Halfway through 200 -> 800 and
      // 800 -> 200 in the group's units, both are at 500 * 0.5 = 250.
      const surfaceXs = findByLabel(stage, "group")
        .children.filter((child) => !child.label)
        .map((surface) => Math.round(surface.children[0].x));

      expect(surfaceXs).toEqual([250, 250]);
    });

    it("continues a persistent child tween in a scaled container across renders", () => {
      const { animationBus, render } = createRun();
      const drift = {
        ...topLeftTween,
        id: "top-left-drift",
        tween: { x: topLeftTween.tween.x },
        playback: { continuity: "persistent", loop: true },
      };
      const state = {
        elements: [parsed(canvasAt(0.5, rect("top-left", 80, 80, 320, 180)))],
        animations: normalizeAnimations([drift]),
      };

      render([], state.elements, [drift]);
      animationBus.tick(200);

      const plan = buildAnimationContinuityPlan({
        prevState: state,
        nextState: state,
        activeAnimations: animationBus.getContinuableAnimations(),
      });

      expect(plan.continuedAnimationIds.has(drift.id)).toBe(true);
    });
  });

  describe("getContainerChildAnimations", () => {
    const element = parseContainerForTesting({
      state: {
        id: "outer",
        type: "container",
        scaleX: 0.5,
        scaleY: 2,
        children: [canvas()],
      },
    });
    const update = (id, targetId, tween) => ({
      id,
      targetId,
      type: "update",
      tween,
    });

    it("converts only its direct children's position and size tracks", () => {
      const animations = [
        update("own", "outer", { x: { keyframes: [{ value: 10 }] } }),
        update("child", "canvas", {
          x: { initialValue: 2, keyframes: [{ value: 10, startValue: 4 }] },
          "rect.height": { keyframes: [{ value: 10 }] },
          "rect.border.width": { keyframes: [{ value: 10 }] },
          alpha: { keyframes: [{ value: 0.5 }] },
          scaleX: { keyframes: [{ value: 3 }] },
          translateX: { keyframes: [{ value: 0.5 }] },
          y: { auto: { duration: 100 } },
        }),
        update("grandchild", "top-left", {
          x: { keyframes: [{ value: 10 }] },
        }),
        {
          id: "child-transition",
          targetId: "canvas",
          type: "transition",
          prev: { tween: { alpha: { keyframes: [{ value: 0 }] } } },
          next: {
            tween: {
              y: { initialValue: 4, keyframes: [{ value: 10 }] },
              translateY: { keyframes: [{ value: 1 }] },
            },
          },
          mask: { progress: { keyframes: [{ value: 1 }] } },
        },
        {
          id: "child-gsap",
          targetId: "canvas",
          type: "update",
          gsap: { to: { x: 10 } },
        },
      ];
      const original = structuredClone(animations);

      const converted = getContainerChildAnimations(animations, element);
      const [childUpdate, childTransition, childGsap] = converted.get("canvas");

      expect(childUpdate.tween.x).toEqual({
        initialValue: 1,
        keyframes: [{ value: 5, startValue: 2 }],
      });
      expect(childUpdate.tween["rect.height"].keyframes[0].value).toBe(20);
      expect(childUpdate.tween["rect.border.width"]).toBe(
        animations[1].tween["rect.border.width"],
      );
      expect(childUpdate.tween.alpha).toBe(animations[1].tween.alpha);
      expect(childUpdate.tween.scaleX).toBe(animations[1].tween.scaleX);
      expect(childUpdate.tween.translateX).toBe(animations[1].tween.translateX);
      expect(childUpdate.tween.y).toBe(animations[1].tween.y);
      expect(childUpdate.signature).toBe(
        getAnimationContinuitySignature(animations[1]),
      );
      expect(childTransition.next.tween.y).toEqual({
        initialValue: 8,
        keyframes: [{ value: 20 }],
      });
      expect(childTransition.next.tween.translateY).toBe(
        animations[3].next.tween.translateY,
      );
      expect(childTransition.prev).toBe(animations[3].prev);
      expect(childTransition.mask).toBe(animations[3].mask);
      expect(childTransition.signature).toBe(
        getAnimationContinuitySignature(animations[3]),
      );
      expect(childGsap).toBe(animations[4]);
      expect(converted.get("outer")[0]).toBe(animations[0]);
      expect(converted.get("top-left")[0]).toBe(animations[2]);
      expect(animations).toEqual(original);
    });

    it("converts each side of a transition in the container that draws it", () => {
      const outer = (children) =>
        parseContainerForTesting({
          state: {
            id: "outer",
            type: "container",
            scaleX: 0.5,
            scaleY: 2,
            children,
          },
        });
      const prevElement = outer([canvas(), rect("leaving", 0, 0, 10, 10)]);
      const nextElement = outer([canvas(), rect("entering", 0, 0, 10, 10)]);
      // A child that leaves or enters this container may come from or go to
      // another one, which converts the other side.
      const slide = (targetId) => ({
        id: `${targetId}-slide`,
        targetId,
        type: "transition",
        prev: { tween: { x: { keyframes: [{ value: 800 }] } } },
        next: { tween: { x: { keyframes: [{ value: 600 }] } } },
      });
      const animations = [slide("canvas"), slide("leaving"), slide("entering")];

      const converted = getContainerChildAnimations(
        animations,
        nextElement,
        prevElement,
      );
      const slideValues = (targetId) => {
        const [{ prev, next }] = converted.get(targetId);
        return [prev, next].map((side) => side.tween.x.keyframes[0].value);
      };

      expect(slideValues("canvas")).toEqual([400, 300]);
      expect(slideValues("leaving")).toEqual([400, 600]);
      expect(slideValues("entering")).toEqual([800, 300]);
      // Without the previous state, a removed child is not one of the children.
      expect(
        getContainerChildAnimations([slide("leaving")], nextElement),
      ).toEqual([slide("leaving")]);
    });

    it("returns the animations unchanged when nothing needs converting", () => {
      const animations = [
        update("child", "canvas", { x: { keyframes: [{ value: 10 }] } }),
      ];
      const unscaled = parseContainerForTesting({ state: canvas() });

      expect(getContainerChildAnimations(animations, unscaled)).toBe(
        animations,
      );
      expect(
        getContainerChildAnimations(
          [update("own", "outer", { x: { keyframes: [{ value: 10 }] } })],
          element,
        ),
      ).toEqual([
        update("own", "outer", { x: { keyframes: [{ value: 10 }] } }),
      ]);
    });
  });
});
