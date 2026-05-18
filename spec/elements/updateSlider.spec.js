import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import { addSlider } from "../../src/plugins/elements/slider/addSlider.js";
import { updateSlider } from "../../src/plugins/elements/slider/updateSlider.js";

const createSharedParams = () => ({
  app: {
    audioStage: {
      add: vi.fn(),
    },
  },
  animations: [],
  animationBus: {
    dispatch: vi.fn(),
  },
  completionTracker: {
    getVersion: () => 0,
    track: () => {},
    complete: () => {},
  },
});

const createSharedParamsWithNativeDrag = () => ({
  ...createSharedParams(),
  app: {
    audioStage: {
      add: vi.fn(),
    },
    renderer: {
      events: {
        mapPositionToPoint: (point, x, y) => {
          point.x = x;
          point.y = y;
        },
      },
    },
  },
});

const createSliderElement = (overrides = {}) => ({
  id: "slider-1",
  type: "slider",
  x: 100,
  y: 100,
  width: 200,
  height: 20,
  alpha: 1,
  direction: "horizontal",
  min: 0,
  max: 100,
  step: 1,
  initialValue: 0,
  change: {
    payload: { source: "drag" },
  },
  ...overrides,
});

describe("updateSlider", () => {
  it("keeps dragging active when renders update the slider value", () => {
    const parent = new Container();
    const eventHandler = vi.fn();
    const shared = createSharedParamsWithNativeDrag();
    const prevElement = createSliderElement();

    addSlider({
      ...shared,
      parent,
      eventHandler,
      zIndex: 0,
      element: prevElement,
    });

    const slider = parent.getChildByLabel("slider-1");

    slider.emit("pointerdown", { global: { x: 280, y: 110 } });

    const nextElement = createSliderElement({
      initialValue: eventHandler.mock.calls[0][1]._event.value,
    });

    updateSlider({
      ...shared,
      parent,
      prevElement,
      nextElement,
      eventHandler,
      zIndex: 0,
    });

    const moveEvent =
      typeof PointerEvent === "function"
        ? new PointerEvent("pointermove", {
            clientX: 290,
            clientY: 110,
            bubbles: true,
          })
        : new MouseEvent("mousemove", {
            clientX: 290,
            clientY: 110,
            bubbles: true,
          });
    const upEvent =
      typeof PointerEvent === "function"
        ? new PointerEvent("pointerup", {
            clientX: 290,
            clientY: 110,
            bubbles: true,
          })
        : new MouseEvent("mouseup", {
            clientX: 290,
            clientY: 110,
            bubbles: true,
          });

    document.dispatchEvent(moveEvent);
    window.dispatchEvent(upEvent);

    expect(eventHandler).toHaveBeenCalledTimes(2);
    expect(eventHandler.mock.calls[1][0]).toBe("change");
    expect(eventHandler.mock.calls[1][1]._event.value).toBeGreaterThan(
      eventHandler.mock.calls[0][1]._event.value,
    );
  });

  it("syncs programmatic value updates before the next pointerdown", () => {
    const parent = new Container();
    const eventHandler = vi.fn();
    const shared = createSharedParams();
    const prevElement = createSliderElement();

    addSlider({
      ...shared,
      parent,
      eventHandler,
      zIndex: 0,
      element: prevElement,
    });

    updateSlider({
      ...shared,
      parent,
      prevElement,
      nextElement: createSliderElement({ initialValue: 100 }),
      eventHandler,
      zIndex: 0,
    });

    const slider = parent.getChildByLabel("slider-1");

    eventHandler.mockClear();
    slider.emit("pointerdown", { global: { x: 300, y: 110 } });

    expect(eventHandler).not.toHaveBeenCalled();
  });
});
