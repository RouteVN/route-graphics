import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import { setupScrollInteraction } from "../../src/plugins/elements/util/setupScrollInteraction.js";
import { setupScrolling } from "../../src/plugins/elements/container/util/scrollingUtils.js";

// Pixi watches wheel on the canvas with { passive: true, capture: true }. A
// preventDefault() from a Pixi wheel handler reaches the native event inside
// that passive listener, where the browser ignores it and logs "Unable to
// preventDefault inside passive event listener invocation".

/**
 * Deliver a native wheel event to `target` the way Pixi's EventSystem does:
 * from a passive capture listener on the canvas, as a federated event whose
 * preventDefault() cancels the native event when it is cancelable.
 */
const bridgeWheelLikePixi = ({ canvas, target }) => {
  const state = { inPassiveListener: false };
  canvas.addEventListener(
    "wheel",
    (nativeEvent) => {
      state.inPassiveListener = true;
      try {
        target.emit("wheel", {
          deltaX: nativeEvent.deltaX,
          deltaY: nativeEvent.deltaY,
          shiftKey: nativeEvent.shiftKey,
          nativeEvent,
          preventDefault() {
            if (nativeEvent.cancelable) nativeEvent.preventDefault();
          },
        });
      } finally {
        state.inPassiveListener = false;
      }
    },
    { passive: true, capture: true },
  );
  return state;
};

/** A native wheel event that records which listener calls preventDefault(). */
const createWheelEvent = (state, init = {}) => {
  const event = new window.WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    deltaY: 40,
    ...init,
  });
  const callers = [];
  const preventDefault = event.preventDefault.bind(event);
  event.preventDefault = () => {
    callers.push(state.inPassiveListener ? "passive" : "non-passive");
    preventDefault();
  };
  return { event, callers };
};

const createScrollableElement = () => ({
  id: "list",
  type: "container",
  x: 0,
  y: 0,
  width: 100,
  height: 120,
  alpha: 1,
  scroll: true,
  children: [
    { id: "item-1", type: "rect", x: 0, y: 0, width: 80, height: 60 },
    { id: "item-2", type: "rect", x: 0, y: 65, width: 80, height: 60 },
    { id: "item-3", type: "rect", x: 0, y: 130, width: 80, height: 60 },
  ],
});

describe("wheel handling under Pixi's passive wheel listener", () => {
  it("scroll events do not call preventDefault from Pixi's passive listener", () => {
    const canvas = document.createElement("canvas");
    const displayObject = new Container();
    displayObject.label = "target";
    const eventHandler = vi.fn();
    setupScrollInteraction({
      canvas,
      displayObject,
      scrollUpEvent: { payload: { direction: "up" } },
      scrollDownEvent: { payload: { direction: "down" } },
      eventHandler,
    });
    const state = bridgeWheelLikePixi({ canvas, target: displayObject });

    displayObject.emit("pointerover");
    const { event, callers } = createWheelEvent(state);
    canvas.dispatchEvent(event);

    expect(eventHandler.mock.calls.map((call) => call[0])).toEqual([
      "scrollDown",
    ]);
    expect(callers).toEqual(["non-passive"]);
    // The page still does not scroll beneath the hovered element.
    expect(event.defaultPrevented).toBe(true);
  });

  it("emits scroll events from Pixi's wheel alone without calling preventDefault", () => {
    const canvas = document.createElement("canvas");
    const displayObject = new Container();
    displayObject.label = "target";
    const eventHandler = vi.fn();
    setupScrollInteraction({
      canvas,
      displayObject,
      scrollUpEvent: {},
      eventHandler,
    });
    const state = bridgeWheelLikePixi({ canvas, target: displayObject });

    // The pointer never reported pointerover, so only Pixi's listener reacts.
    const { event, callers } = createWheelEvent(state, { deltaY: -40 });
    canvas.dispatchEvent(event);

    expect(eventHandler.mock.calls.map((call) => call[0])).toEqual([
      "scrollUp",
    ]);
    expect(callers).toEqual([]);
  });

  it("registers its page-scroll guard as a non-passive canvas listener", () => {
    const canvas = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const displayObject = new Container();
    setupScrollInteraction({
      canvas,
      displayObject,
      scrollDownEvent: {},
      eventHandler: vi.fn(),
    });

    expect(canvas.addEventListener).toHaveBeenCalledWith(
      "wheel",
      expect.any(Function),
      { passive: false },
    );
  });

  it("a scrolling container scrolls without calling preventDefault from Pixi's passive listener", () => {
    const canvas = document.createElement("canvas");
    const container = new Container();
    container.label = "list";
    const element = createScrollableElement();
    for (const child of element.children) {
      const childContainer = new Container();
      childContainer.label = child.id;
      container.addChild(childContainer);
    }
    setupScrolling({ container, element });
    const state = bridgeWheelLikePixi({ canvas, target: container });

    const { event, callers } = createWheelEvent(state);
    canvas.dispatchEvent(event);

    expect(container.getChildByLabel("list-content").y).toBe(-40);
    expect(callers).toEqual([]);
  });
});
