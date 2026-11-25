import { Container } from "pixi.js";
import { describe, expect, it } from "vitest";

import { createAnimationBus } from "../../src/plugins/animations/animationBus.js";
import { buildAnimationContinuityPlan } from "../../src/plugins/animations/planAnimations.js";
import { containerPlugin } from "../../src/plugins/elements/container/index.js";
import { parseElements } from "../../src/plugins/elements/parseElements.js";
import { createParserPlugin } from "../../src/plugins/elements/parserPlugin.js";
import { renderElements } from "../../src/plugins/elements/renderElements.js";
import { textRevealingPlugin } from "../../src/plugins/elements/text-revealing/index.js";
import { createCompletionTracker } from "../../src/util/completionTracker.js";

const elementPlugins = [containerPlugin, textRevealingPlugin];
// Lets deferred element updates and their completions run.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const parserPlugins = elementPlugins.map(({ type, parse }) =>
  createParserPlugin({ type, parse }),
);

// Renders states the way RouteGraphics.renderInternal does: one animation
// bus and completion tracker, a reservation for the render itself, and every
// animation the render does not continue cancelled before elements update.
const createRenderer = () => {
  const renderCompletes = [];
  const completionTracker = createCompletionTracker((eventName, payload) => {
    if (eventName === "renderComplete") {
      renderCompletes.push(payload);
    }
  });
  const animationBus = createAnimationBus();
  const stage = new Container();
  let state = { elements: [], animations: [] };
  let renderController;

  const render = async ({ id, elements, animations = [] }) => {
    const nextState = {
      id,
      elements: parseElements({ JSONObject: elements, parserPlugins }),
      animations,
    };
    const continuityPlan = buildAnimationContinuityPlan({
      prevState: state,
      nextState,
      activeAnimations: animationBus.getContinuableAnimations(),
    });

    renderController?.abort();
    renderController = new AbortController();
    completionTracker.reset(id);
    const version = completionTracker.getVersion();
    completionTracker.track(version);
    animationBus.cancelAllExcept(continuityPlan.continuedAnimationIds);

    const operation = renderElements({
      app: {},
      parent: stage,
      prevComputedTree: state.elements,
      nextComputedTree: nextState.elements,
      animations,
      elementPlugins,
      animationBus,
      completionTracker,
      eventHandler: () => {},
      signal: renderController.signal,
    });
    animationBus.flush();
    state = nextState;
    await operation;
    animationBus.flush();
    completionTracker.complete(version);
    completionTracker.completeIfEmpty();
  };

  const getWipe = (id) =>
    animationBus
      .getState()
      .animations.find((animation) => animation.id === `${id}-soft-wipe`);
  const getReveal = (id) => stage.getChildByLabel(id, true);
  const getIndicatorPosition = (id) => {
    const { x, y } = getReveal(id).children[1];
    return { x, y };
  };
  const getLineMasks = (id) =>
    getReveal(id)
      .getChildByLabel(`${id}-content`)
      .children.filter((child) => child.label?.startsWith(`${id}-line-`))
      .map((line) => line.mask);

  return {
    animationBus,
    render,
    renderCompletes,
    getWipe,
    getIndicatorPosition,
    getLineMasks,
  };
};

const createLine = (overrides = {}) => ({
  id: "line",
  type: "text-revealing",
  x: 40,
  y: 40,
  width: 360,
  speed: 35,
  revealEffect: "softWipe",
  softWipe: { easing: "linear" },
  content: [
    {
      text: "A line drawn again while its soft wipe runs keeps wiping from where it was.",
    },
  ],
  textStyle: { fontSize: 20, fontFamily: "Arial", breakWords: false },
  ...overrides,
});

const layouts = [
  ["left to right", {}],
  [
    "right to left",
    {
      direction: "rtl",
      content: [{ text: "שלום עולם, השורה ממשיכה להיחשף מאותה נקודה." }],
    },
  ],
  [
    "vertical",
    {
      width: undefined,
      height: 260,
      writingMode: "vertical-rl",
      content: [{ text: "同じ行をもう一度描いても、ワイプは続きから進む。" }],
    },
  ],
];

describe("text-revealing soft wipe across renders", () => {
  it.each(layouts)(
    "resumes a %s wipe when the same state renders again",
    async (_layout, overrides) => {
      const renderer = createRenderer();
      const line = createLine(overrides);

      await renderer.render({ id: "first", elements: [line] });
      const { duration } = renderer.getWipe("line");
      renderer.animationBus.tick(duration * 0.4);
      const reachedPosition = renderer.getIndicatorPosition("line");

      await renderer.render({ id: "same-state", elements: [line] });

      expect(renderer.renderCompletes).toEqual([
        { id: "first", aborted: true },
      ]);
      expect(renderer.getWipe("line")).toMatchObject({
        currentTime: duration * 0.4,
        duration,
      });
      expect(renderer.getIndicatorPosition("line")).toEqual(reachedPosition);
      expect(renderer.getLineMasks("line").every(Boolean)).toBe(true);

      renderer.animationBus.tick(duration * 0.3);

      expect(renderer.getWipe("line").currentTime).toBeCloseTo(duration * 0.7);
      expect(renderer.getIndicatorPosition("line")).not.toEqual(
        reachedPosition,
      );
      expect(renderer.renderCompletes).toHaveLength(1);

      renderer.animationBus.tick(duration);

      expect(renderer.renderCompletes).toEqual([
        { id: "first", aborted: true },
        { id: "same-state", aborted: false },
      ]);
      expect(renderer.getWipe("line")).toBeUndefined();
      expect(renderer.getLineMasks("line").some(Boolean)).toBe(false);
    },
  );

  it("completes once after the same state renders several times", async () => {
    const renderer = createRenderer();
    const line = createLine();

    await renderer.render({ id: "render-1", elements: [line] });
    const { duration } = renderer.getWipe("line");

    for (const id of ["render-2", "render-3", "render-4"]) {
      renderer.animationBus.tick(duration * 0.2);
      await renderer.render({ id, elements: [line] });
    }

    expect(renderer.getWipe("line").currentTime).toBeCloseTo(duration * 0.6);

    renderer.animationBus.tick(duration);

    expect(renderer.renderCompletes).toEqual([
      { id: "render-1", aborted: true },
      { id: "render-2", aborted: true },
      { id: "render-3", aborted: true },
      { id: "render-4", aborted: false },
    ]);
  });

  it("keeps the wipe's frame while a container tween delays the resume", async () => {
    const renderer = createRenderer();
    const box = {
      id: "box",
      type: "container",
      x: 0,
      y: 0,
      children: [createLine()],
    };

    await renderer.render({ id: "first", elements: [box] });
    const { duration } = renderer.getWipe("line");
    renderer.animationBus.tick(duration * 0.4);
    const reachedPosition = renderer.getIndicatorPosition("line");

    await renderer.render({
      id: "box-moves",
      elements: [box],
      animations: [
        {
          id: "box-tween",
          targetId: "box",
          type: "update",
          tween: {
            x: { keyframes: [{ duration: 300, value: 0, easing: "linear" }] },
          },
        },
      ],
    });

    // The text updates when the container tween ends. Until then the line
    // shows the frame it reached instead of all of its text.
    expect(renderer.getWipe("line")).toBeUndefined();
    expect(renderer.getLineMasks("line").every(Boolean)).toBe(true);
    expect(renderer.getIndicatorPosition("line")).toEqual(reachedPosition);

    renderer.animationBus.tick(300);
    await settle();
    renderer.animationBus.flush();

    expect(renderer.getWipe("line")).toMatchObject({
      currentTime: duration * 0.4,
    });
    expect(renderer.renderCompletes).toEqual([{ id: "first", aborted: true }]);

    renderer.animationBus.tick(duration);
    await settle();

    expect(renderer.renderCompletes).toEqual([
      { id: "first", aborted: true },
      { id: "box-moves", aborted: false },
    ]);
    expect(renderer.getLineMasks("line").some(Boolean)).toBe(false);
  });

  it("restarts the wipe when the next render changes the text", async () => {
    const renderer = createRenderer();

    await renderer.render({ id: "first", elements: [createLine()] });
    const { duration } = renderer.getWipe("line");
    renderer.animationBus.tick(duration * 0.4);

    await renderer.render({
      id: "next-line",
      elements: [createLine({ content: [{ text: "A different line." }] })],
    });

    expect(renderer.getWipe("line").currentTime).toBe(0);
  });

  it("shows all of the text when the next render turns the reveal off", async () => {
    const renderer = createRenderer();

    await renderer.render({ id: "first", elements: [createLine()] });
    renderer.animationBus.tick(renderer.getWipe("line").duration * 0.4);

    await renderer.render({
      id: "settled",
      elements: [createLine({ revealEffect: "none" })],
    });

    expect(renderer.getWipe("line")).toBeUndefined();
    expect(renderer.getLineMasks("line").some(Boolean)).toBe(false);
    expect(renderer.renderCompletes).toEqual([
      { id: "first", aborted: true },
      { id: "settled", aborted: false },
    ]);
  });

  it("releases a cancelled wipe's masks when the next render removes the line", async () => {
    const renderer = createRenderer();

    await renderer.render({ id: "first", elements: [createLine()] });
    renderer.animationBus.tick(renderer.getWipe("line").duration * 0.4);
    const maskTextures = renderer
      .getLineMasks("line")
      .map((mask) => mask.texture);

    await renderer.render({ id: "empty", elements: [] });

    expect(maskTextures.length).toBeGreaterThan(0);
    expect(maskTextures.every((texture) => texture.destroyed)).toBe(true);
    expect(renderer.animationBus.getState().activeCount).toBe(0);
  });
});
