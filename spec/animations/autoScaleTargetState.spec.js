import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import { createAnimationBus } from "../../src/plugins/animations/animationBus.js";
import {
  dispatchUpdateAnimations,
  groupAnimationsByTarget,
} from "../../src/plugins/animations/planAnimations.js";
import {
  createRenderContext,
  flushDeferredMountOperations,
} from "../../src/plugins/elements/renderContext.js";
import { addRect } from "../../src/plugins/elements/rect/addRect.js";
import { parseRect } from "../../src/plugins/elements/rect/parseRect.js";
import { updateRect } from "../../src/plugins/elements/rect/updateRect.js";
import { updateContainer } from "../../src/plugins/elements/container/updateContainer.js";
import { addText } from "../../src/plugins/elements/text/addText.js";
import { parseText } from "../../src/plugins/elements/text/parseText.js";
import { updateText } from "../../src/plugins/elements/text/updateText.js";
import { createCompletionTracker } from "../../src/util/completionTracker.js";
import { normalizeAnimations } from "../../src/util/normalizeAnimations.js";

const autoTween = { auto: { duration: 200, easing: "linear" } };

const createAutoScaleAnimation = (targetId, tween = {}) => ({
  id: `${targetId}-auto-scale`,
  targetId,
  type: "update",
  tween: {
    scaleX: autoTween,
    scaleY: autoTween,
    ...tween,
  },
});

const createRecordingBus = () => ({ dispatch: vi.fn() });

const createStubTracker = () => ({
  getVersion: () => 1,
  track: vi.fn(),
  complete: vi.fn(),
});

const getStartPayload = (animationBus) =>
  animationBus.dispatch.mock.calls.find(
    ([command]) => command.type === "START",
  )?.[0].payload;

const createLiveRender = () => {
  const animationBus = createAnimationBus();
  const completionTracker = createCompletionTracker();
  completionTracker.reset("auto-scale-render");
  return { animationBus, completionTracker };
};

describe("auto scale tweens without an authored scale", () => {
  it("resolves an unset scale to 1", () => {
    const animationBus = createRecordingBus();

    dispatchUpdateAnimations({
      animations: groupAnimationsByTarget([createAutoScaleAnimation("box")]),
      targetId: "box",
      animationBus,
      completionTracker: createStubTracker(),
      element: { x: 0, y: 0, alpha: 1, scale: { x: 0.5, y: 0.25 } },
      targetState: { x: 0, y: 0, alpha: 1 },
    });

    expect(getStartPayload(animationBus).targetState).toEqual({
      x: 0,
      y: 0,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
    });
  });

  it("resolves only the unset axis when one axis is authored", () => {
    const animationBus = createRecordingBus();

    dispatchUpdateAnimations({
      animations: groupAnimationsByTarget([createAutoScaleAnimation("box")]),
      targetId: "box",
      animationBus,
      completionTracker: createStubTracker(),
      element: { x: 0, y: 0, alpha: 1, scale: { x: 0.5, y: 0.25 } },
      targetState: { x: 0, y: 0, scaleX: -1 },
    });

    expect(getStartPayload(animationBus).targetState).toEqual({
      x: 0,
      y: 0,
      scaleX: -1,
      scaleY: 1,
    });
  });

  it.each([
    ["positive", 1.5, 0.6],
    ["negative", -2, -0.5],
    ["zero", 0, 0],
  ])(
    "keeps resolving an authored %s scale to the authored value",
    (_label, scaleX, scaleY) => {
      const animationBus = createRecordingBus();
      const targetState = { x: 0, y: 0, scaleX, scaleY };

      dispatchUpdateAnimations({
        animations: groupAnimationsByTarget([createAutoScaleAnimation("box")]),
        targetId: "box",
        animationBus,
        completionTracker: createStubTracker(),
        element: { x: 0, y: 0, scale: { x: 1, y: 1 } },
        targetState,
      });

      expect(getStartPayload(animationBus).targetState).toBe(targetState);
      expect(targetState).toEqual({ x: 0, y: 0, scaleX, scaleY });
    },
  );

  it("leaves the target state alone when no Auto tween animates scale", () => {
    const animationBus = createRecordingBus();
    const targetState = { x: 0, y: 0, alpha: 1 };

    dispatchUpdateAnimations({
      animations: groupAnimationsByTarget([
        {
          id: "box-pulse",
          targetId: "box",
          type: "update",
          tween: {
            scaleX: {
              keyframes: [{ duration: 200, value: 1.2, easing: "linear" }],
            },
            alpha: autoTween,
          },
        },
      ]),
      targetId: "box",
      animationBus,
      completionTracker: createStubTracker(),
      element: { x: 0, y: 0, alpha: 0.5, scale: { x: 1, y: 1 } },
      targetState,
    });

    expect(getStartPayload(animationBus).targetState).toBe(targetState);
    expect(targetState).toEqual({ x: 0, y: 0, alpha: 1 });
  });

  it("still reports other Auto properties missing from the target state", () => {
    const animationBus = createRecordingBus();

    expect(() =>
      dispatchUpdateAnimations({
        animations: groupAnimationsByTarget([
          createAutoScaleAnimation("box", { blurX: autoTween }),
        ]),
        targetId: "box",
        animationBus,
        completionTracker: createStubTracker(),
        element: { x: 0, y: 0, scale: { x: 0.5, y: 0.5 } },
        targetState: { x: 0, y: 0 },
      }),
    ).toThrow(
      'Animation "box-auto-scale" cannot auto-resolve property "blurX" from targetState.',
    );
    expect(animationBus.dispatch).not.toHaveBeenCalled();
  });

  it("does not resolve scale for a removal without a target state", () => {
    expect(() =>
      dispatchUpdateAnimations({
        animations: groupAnimationsByTarget([createAutoScaleAnimation("box")]),
        targetId: "box",
        animationBus: createRecordingBus(),
        completionTracker: createStubTracker(),
        element: { x: 0, y: 0, scale: { x: 0.5, y: 0.5 } },
        targetState: null,
      }),
    ).toThrow(
      'Animation "box-auto-scale" cannot auto-resolve property "scaleX" from targetState.',
    );
  });

  it("resolves an unset scale for a deferred mount", () => {
    const animationBus = createRecordingBus();
    const renderContext = createRenderContext({ suppressAnimations: true });

    dispatchUpdateAnimations({
      animations: groupAnimationsByTarget([createAutoScaleAnimation("box")]),
      targetId: "box",
      animationBus,
      completionTracker: createStubTracker(),
      element: { x: 0, y: 0, scale: { x: 0.5, y: 0.5 } },
      targetState: { x: 0, y: 0 },
      renderContext,
    });
    flushDeferredMountOperations(renderContext);

    expect(getStartPayload(animationBus).targetState).toEqual({
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
    });
  });

  it("animates an unscaled rect back to scale 1", () => {
    const parent = new Container();
    const app = { audioStage: { add: vi.fn() } };
    const rectState = {
      id: "rect-1",
      type: "rect",
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      fill: "red",
    };
    const prevElement = parseRect({
      state: { ...rectState, scaleX: 0.5, scaleY: 0.5 },
    });
    const nextElement = parseRect({ state: rectState });
    const { animationBus, completionTracker } = createLiveRender();

    addRect({
      app,
      parent,
      element: prevElement,
      animations: [],
      animationBus,
      completionTracker,
      eventHandler: vi.fn(),
      zIndex: 0,
    });
    const rect = parent.getChildByLabel("rect-1");

    updateRect({
      app,
      parent,
      prevElement,
      nextElement,
      animations: normalizeAnimations([createAutoScaleAnimation("rect-1")]),
      animationBus,
      completionTracker,
      eventHandler: vi.fn(),
      zIndex: 0,
    });
    animationBus.flush();

    expect(rect.scale.x).toBeCloseTo(0.5);
    expect(rect.scale.y).toBeCloseTo(0.5);

    animationBus.tick(100);
    expect(rect.scale.x).toBeCloseTo(0.75);
    expect(rect.scale.y).toBeCloseTo(0.75);

    animationBus.tick(100);
    expect(rect.scale.x).toBe(1);
    expect(rect.scale.y).toBe(1);
    expect(rect.width).toBe(200);
    expect(rect.height).toBe(100);
    expect(animationBus.getState().activeCount).toBe(0);
    animationBus.destroy();
  });

  it("keeps the forced blur target beside an unset scale target", () => {
    const parent = new Container();
    const app = { audioStage: { add: vi.fn() } };
    const element = parseRect({
      state: {
        id: "rect-1",
        type: "rect",
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        alpha: 0.5,
        fill: "red",
      },
    });
    const animationBus = createRecordingBus();
    const completionTracker = createStubTracker();

    addRect({
      app,
      parent,
      element,
      animations: [],
      animationBus,
      completionTracker,
      eventHandler: vi.fn(),
      zIndex: 0,
    });
    updateRect({
      app,
      parent,
      prevElement: element,
      nextElement: { ...element, alpha: 1 },
      animations: normalizeAnimations([
        createAutoScaleAnimation("rect-1", {
          alpha: autoTween,
          blurX: autoTween,
          blurY: autoTween,
        }),
      ]),
      animationBus,
      completionTracker,
      eventHandler: vi.fn(),
      zIndex: 0,
    });

    expect(getStartPayload(animationBus).targetState).toMatchObject({
      x: 100,
      y: 100,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      blurX: 0,
      blurY: 0,
    });
  });

  it("animates an unscaled container back to scale 1", () => {
    const parent = new Container();
    const containerElement = new Container();
    containerElement.label = "container-1";
    containerElement.scale.set(0.5, 0.5);
    parent.addChild(containerElement);
    const element = {
      id: "container-1",
      type: "container",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      alpha: 1,
      children: [],
    };
    const { animationBus, completionTracker } = createLiveRender();

    updateContainer({
      app: { audioStage: { add: vi.fn() } },
      parent,
      prevElement: element,
      nextElement: { ...element, x: 10 },
      eventHandler: vi.fn(),
      animations: normalizeAnimations([
        createAutoScaleAnimation("container-1"),
      ]),
      animationBus,
      elementPlugins: [],
      zIndex: 0,
      completionTracker,
      signal: new AbortController().signal,
    });
    animationBus.flush();

    animationBus.tick(100);
    expect(containerElement.scale.x).toBeCloseTo(0.75);
    expect(containerElement.scale.y).toBeCloseTo(0.75);

    animationBus.tick(100);
    expect(containerElement.scale.x).toBe(1);
    expect(containerElement.scale.y).toBe(1);
    expect(animationBus.getState().activeCount).toBe(0);
    animationBus.destroy();
  });

  it("animates unscaled text back to scale 1", () => {
    const parent = new Container();
    const app = { audioStage: { add: vi.fn() } };
    const element = parseText({
      state: {
        id: "text-1",
        type: "text",
        x: 20,
        y: 30,
        content: "Hello",
        textStyle: { fontSize: 24, fontFamily: "Arial", fill: "#FFFFFF" },
      },
    });
    const { animationBus, completionTracker } = createLiveRender();

    addText({
      app,
      parent,
      element,
      animations: [],
      animationBus,
      completionTracker,
      eventHandler: vi.fn(),
      zIndex: 0,
    });
    const text = parent.getChildByLabel("text-1");
    text.scale.set(0.5, 0.5);

    updateText({
      app,
      parent,
      prevElement: element,
      nextElement: { ...element, x: element.x + 10 },
      animations: normalizeAnimations([createAutoScaleAnimation("text-1")]),
      animationBus,
      completionTracker,
      eventHandler: vi.fn(),
      zIndex: 0,
    });
    animationBus.flush();

    animationBus.tick(100);
    expect(text.scale.x).toBeCloseTo(0.75);
    expect(text.scale.y).toBeCloseTo(0.75);

    animationBus.tick(100);
    expect(text.scale.x).toBe(1);
    expect(text.scale.y).toBe(1);
    expect(animationBus.getState().activeCount).toBe(0);
    animationBus.destroy();
  });

  it("keeps an authored text scale as the Auto target", () => {
    const parent = new Container();
    const app = { audioStage: { add: vi.fn() } };
    const textState = {
      id: "text-1",
      type: "text",
      x: 20,
      y: 30,
      content: "Hello",
      textStyle: { fontSize: 24, fontFamily: "Arial", fill: "#FFFFFF" },
    };
    const prevElement = parseText({ state: textState });
    const nextElement = parseText({
      state: { ...textState, scaleX: -2, scaleY: 1.5 },
    });
    const { animationBus, completionTracker } = createLiveRender();

    addText({
      app,
      parent,
      element: prevElement,
      animations: [],
      animationBus,
      completionTracker,
      eventHandler: vi.fn(),
      zIndex: 0,
    });
    const text = parent.getChildByLabel("text-1");

    updateText({
      app,
      parent,
      prevElement,
      nextElement,
      animations: normalizeAnimations([createAutoScaleAnimation("text-1")]),
      animationBus,
      completionTracker,
      eventHandler: vi.fn(),
      zIndex: 0,
    });
    animationBus.flush();

    animationBus.tick(200);
    expect(text.scale.x).toBe(-2);
    expect(text.scale.y).toBe(1.5);
    animationBus.destroy();
  });
});
