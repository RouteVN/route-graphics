import { describe, expect, it, vi } from "vitest";
import { Container } from "pixi.js";
import { createAnimationBus } from "../../src/plugins/animations/animationBus.js";
import { dispatchUpdateAnimationsNow } from "../../src/plugins/animations/updateAnimationDispatch.js";
import { createCompletionTracker } from "../../src/util/completionTracker.js";
import { normalizeAnimations } from "../../src/util/normalizeAnimations.js";
import { addRect } from "../../src/plugins/elements/rect/addRect.js";
import { updateRect } from "../../src/plugins/elements/rect/updateRect.js";
import { parseRect } from "../../src/plugins/elements/rect/parseRect.js";

const createBox = (state = {}) => {
  const element = new Container();
  element.label = "box";
  Object.assign(element, { x: 200, y: 50, alpha: 1 }, state);
  return element;
};

const recordBusEvents = (bus) => {
  const events = [];
  for (const type of ["started", "completed", "cancelled"]) {
    bus.on(type, (payload) => events.push([type, payload]));
  }
  return events;
};

const moveXAnimation = {
  id: "move",
  type: "update",
  targetId: "box",
  tween: {
    x: {
      initialValue: 0,
      keyframes: [{ duration: 200, value: 180, easing: "linear" }],
    },
  },
};

const autoXAnimation = {
  id: "settle-auto",
  type: "update",
  targetId: "box",
  tween: { x: { auto: { duration: 500, easing: "linear" } } },
};

describe("prepared no-op update animations", () => {
  it("completes a prepared all-noop auto immediately after a same-channel sibling applied its first frame", () => {
    const element = createBox();
    const trackerEvents = [];
    const tracker = createCompletionTracker((event, payload) =>
      trackerEvents.push([event, payload]),
    );
    tracker.reset("prepared-noop-render");
    const bus = createAnimationBus();
    const busEvents = recordBusEvents(bus);

    dispatchUpdateAnimationsNow({
      animations: normalizeAnimations([moveXAnimation, autoXAnimation]),
      animationBus: bus,
      completionTracker: tracker,
      element,
      targetState: { x: 200 },
      onComplete: () => {
        element.x = 200;
      },
    });
    tracker.completeIfEmpty();
    bus.flush();

    expect(busEvents).toEqual([
      ["started", { id: "move" }],
      ["completed", { id: "settle-auto" }],
    ]);
    expect(bus.getState()).toMatchObject({
      activeCount: 1,
      animations: [expect.objectContaining({ id: "move" })],
    });
    expect(trackerEvents).toEqual([]);

    bus.tick(100);
    expect(element.x).toBeCloseTo(90);
    expect(bus.getState().activeCount).toBe(1);

    bus.tick(100);
    expect(busEvents).toEqual([
      ["started", { id: "move" }],
      ["completed", { id: "settle-auto" }],
      ["completed", { id: "move" }],
    ]);
    expect(element.x).toBe(200);
    expect(bus.getState().activeCount).toBe(0);
    expect(trackerEvents).toEqual([
      ["renderComplete", { id: "prepared-noop-render", aborted: false }],
    ]);
    bus.destroy();
  });

  it("completes a prepared all-noop auto queued before its same-channel sibling", () => {
    const element = createBox();
    const tracker = createCompletionTracker();
    tracker.reset("auto-first-render");
    const bus = createAnimationBus();
    const busEvents = recordBusEvents(bus);

    dispatchUpdateAnimationsNow({
      animations: normalizeAnimations([autoXAnimation, moveXAnimation]),
      animationBus: bus,
      completionTracker: tracker,
      element,
      targetState: { x: 200 },
      onComplete: () => {
        element.x = 200;
      },
    });
    bus.flush();

    expect(busEvents).toEqual([
      ["completed", { id: "settle-auto" }],
      ["started", { id: "move" }],
    ]);
    expect(bus.getState().activeCount).toBe(1);

    bus.tick(100);
    expect(element.x).toBeCloseTo(90);

    bus.tick(100);
    expect(element.x).toBe(200);
    expect(bus.getState().activeCount).toBe(0);
    bus.destroy();
  });

  it("keeps animating the live properties of a partially pruned prepared timeline", () => {
    const element = createBox();
    const tracker = createCompletionTracker();
    tracker.reset("partial-prune-render");
    const bus = createAnimationBus();
    const busEvents = recordBusEvents(bus);

    dispatchUpdateAnimationsNow({
      animations: normalizeAnimations([
        {
          id: "mixed",
          type: "update",
          targetId: "box",
          tween: {
            x: { auto: { duration: 400, easing: "linear" } },
            y: {
              initialValue: 50,
              keyframes: [{ duration: 200, value: 250, easing: "linear" }],
            },
          },
        },
      ]),
      animationBus: bus,
      completionTracker: tracker,
      element,
      targetState: { x: 200, y: 250 },
      onComplete: () => {
        element.x = 200;
        element.y = 250;
      },
    });
    bus.flush();

    expect(busEvents).toEqual([["started", { id: "mixed" }]]);
    expect(bus.getState().activeCount).toBe(1);
    expect(element.x).toBe(200);

    bus.tick(100);
    expect(element.x).toBe(200);
    expect(element.y).toBeCloseTo(150);

    bus.tick(100);
    expect(busEvents).toEqual([
      ["started", { id: "mixed" }],
      ["completed", { id: "mixed" }],
    ]);
    expect(element.x).toBe(200);
    expect(element.y).toBe(250);
    expect(bus.getState().activeCount).toBe(0);
    bus.destroy();
  });

  it("keeps an explicit equal-endpoint tween active for its full duration", () => {
    const element = createBox();
    const tracker = createCompletionTracker();
    tracker.reset("equal-endpoints-render");
    const bus = createAnimationBus();
    const busEvents = recordBusEvents(bus);

    dispatchUpdateAnimationsNow({
      animations: normalizeAnimations([
        {
          id: "equal-endpoints",
          type: "update",
          targetId: "box",
          tween: {
            x: {
              initialValue: 200,
              keyframes: [{ duration: 300, value: 200, easing: "linear" }],
            },
          },
        },
      ]),
      animationBus: bus,
      completionTracker: tracker,
      element,
      targetState: { x: 200 },
      onComplete: () => {
        element.x = 200;
      },
    });
    bus.flush();

    expect(busEvents).toEqual([["started", { id: "equal-endpoints" }]]);
    expect(bus.getState()).toMatchObject({
      activeCount: 1,
      animations: [expect.objectContaining({ duration: 300 })],
    });

    bus.tick(299);
    expect(bus.getState().activeCount).toBe(1);
    expect(element.x).toBe(200);

    bus.tick(1);
    expect(busEvents).toEqual([
      ["started", { id: "equal-endpoints" }],
      ["completed", { id: "equal-endpoints" }],
    ]);
    expect(element.x).toBe(200);
    expect(bus.getState().activeCount).toBe(0);
    bus.destroy();
  });

  it.each([
    {
      mode: "repeat",
      playback: { repeat: 1, repeatDelay: 50 },
      expectedDuration: 300,
    },
    {
      mode: "loop",
      playback: { loop: true },
      expectedDuration: 300,
    },
  ])(
    "preserves %s playback of a prepared no-op auto tween",
    ({ mode, playback, expectedDuration }) => {
      const element = createBox();
      const tracker = createCompletionTracker();
      tracker.reset(`${mode}-noop-render`);
      const bus = createAnimationBus();
      const busEvents = recordBusEvents(bus);

      dispatchUpdateAnimationsNow({
        animations: normalizeAnimations([
          {
            id: `${mode}-noop`,
            type: "update",
            targetId: "box",
            playback,
            tween: { x: { auto: { duration: 300, easing: "linear" } } },
          },
        ]),
        animationBus: bus,
        completionTracker: tracker,
        element,
        targetState: { x: 200 },
        onComplete: () => {
          element.x = 200;
        },
      });
      bus.flush();

      expect(busEvents).toEqual([["started", { id: `${mode}-noop` }]]);
      expect(bus.getState()).toMatchObject({
        activeCount: 1,
        animations: [expect.objectContaining({ duration: expectedDuration })],
      });

      if (mode === "repeat") {
        bus.tick(649);
        expect(bus.getState().activeCount).toBe(1);
        expect(element.x).toBe(200);

        bus.tick(1);
        expect(bus.getState().activeCount).toBe(0);
        expect(busEvents).toEqual([
          ["started", { id: `${mode}-noop` }],
          ["completed", { id: `${mode}-noop` }],
        ]);
      } else {
        bus.tick(10_000);
        expect(bus.getState().activeCount).toBe(1);
        expect(element.x).toBe(200);
        expect(busEvents).toEqual([["started", { id: `${mode}-noop` }]]);
      }
      bus.destroy();
    },
  );

  it.each([false, true])(
    "compiles a direct bus auto against current state (explicit undefined: %s)",
    (explicitUndefined) => {
      const bus = createAnimationBus();
      const busEvents = recordBusEvents(bus);
      const element = createBox({ x: 200 });
      const onComplete = vi.fn();

      bus.dispatch({
        type: "START",
        payload: {
          ...(explicitUndefined ? { preparedTimeline: undefined } : {}),
          id: "direct-auto",
          element,
          properties: { x: { auto: { duration: 400, easing: "linear" } } },
          targetState: { x: 200 },
          onComplete,
        },
      });
      element.x = 40;
      bus.flush();

      expect(busEvents).toEqual([["started", { id: "direct-auto" }]]);
      expect(bus.getState().activeCount).toBe(1);

      bus.tick(200);
      expect(element.x).toBeCloseTo(120);

      bus.tick(200);
      expect(element.x).toBeCloseTo(200);
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(bus.getState().activeCount).toBe(0);
      bus.destroy();
    },
  );

  it("does not resurrect a prepared no-op auto through the public rect update path", () => {
    const app = { audioStage: { add: vi.fn() } };
    const completionTracker = {
      getVersion: () => 1,
      track: vi.fn(),
      complete: vi.fn(),
    };
    const parent = new Container();
    const animationBus = createAnimationBus();
    const busEvents = recordBusEvents(animationBus);
    const createState = (overrides = {}) => ({
      id: "panel",
      type: "rect",
      x: 200,
      y: 100,
      width: 200,
      height: 100,
      fill: "#ff0000",
      border: { width: 2, color: "#ffffff", alpha: 1 },
      cornerRadius: 4,
      ...overrides,
    });

    const prevElement = parseRect({ state: createState() });
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
    animationBus.flush();
    const rect = parent.getChildByLabel("panel");
    expect(rect.x).toBe(200);

    updateRect({
      app,
      parent,
      prevElement,
      nextElement: parseRect({ state: createState({ y: 120 }) }),
      animations: normalizeAnimations([
        { ...moveXAnimation, targetId: "panel" },
        { ...autoXAnimation, targetId: "panel" },
      ]),
      animationBus,
      completionTracker,
      eventHandler: vi.fn(),
      zIndex: 0,
    });
    animationBus.flush();

    expect(busEvents).toEqual([
      ["started", { id: "move" }],
      ["completed", { id: "settle-auto" }],
    ]);
    expect(animationBus.getState().activeCount).toBe(1);

    animationBus.tick(100);
    expect(rect.x).toBeCloseTo(90);

    animationBus.tick(100);
    expect(rect.x).toBe(200);
    expect(rect.y).toBe(120);
    expect(animationBus.getState().activeCount).toBe(0);
    expect(busEvents).toEqual([
      ["started", { id: "move" }],
      ["completed", { id: "settle-auto" }],
      ["completed", { id: "move" }],
    ]);
    animationBus.destroy();
  });

  it.each(["cancelAll", "destroy"])(
    "%s discards a queued prepared no-op without completing it",
    (method) => {
      const element = createBox();
      const tracker = createCompletionTracker();
      tracker.reset("queued-cancel-render");
      const bus = createAnimationBus();
      const busEvents = recordBusEvents(bus);

      dispatchUpdateAnimationsNow({
        animations: normalizeAnimations([moveXAnimation, autoXAnimation]),
        animationBus: bus,
        completionTracker: tracker,
        element,
        targetState: { x: 200 },
        onComplete: () => {
          element.x = 200;
        },
      });
      bus[method]();
      bus.flush();
      bus.tick(10);

      expect(busEvents).toEqual([]);
      expect(bus.getState().activeCount).toBe(0);
      expect(element.x).toBe(200);
      if (method === "cancelAll") {
        bus.destroy();
      }
    },
  );
});
