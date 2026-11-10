import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { createAnimationBus } from "../../src/plugins/animations/animationBus.js";
import { containerPlugin } from "../../src/plugins/elements/container/index.js";
import { rectPlugin } from "../../src/plugins/elements/rect/index.js";
import { renderElements } from "../../src/plugins/elements/renderElements.js";
import { refreshElementPivot } from "../../src/plugins/elements/util/transform.js";
import { createCompletionTracker } from "../../src/util/completionTracker.js";
import { hitTestElementBounds } from "../../src/util/hitTestElementBounds.js";
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
          animations,
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
  });
});
