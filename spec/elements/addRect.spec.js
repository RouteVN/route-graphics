import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import { addRect } from "../../src/plugins/elements/rect/addRect.js";
import { parseRect } from "../../src/plugins/elements/rect/parseRect.js";

describe("addRect", () => {
  it("suppresses authored interactions in design mode", () => {
    const parent = new Container();
    const eventHandler = vi.fn();
    const element = parseRect({
      state: {
        id: "rect-1",
        type: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        fill: "#737373",
        hover: { payload: { source: "hover" } },
        click: { payload: { source: "click" } },
        drag: { move: { payload: { source: "drag" } } },
      },
    });

    addRect({
      app: {
        interactionMode: "design",
        audioStage: { add: vi.fn() },
      },
      parent,
      element,
      animations: [],
      animationBus: { dispatch: vi.fn() },
      completionTracker: {
        getVersion: () => 0,
        track: () => {},
        complete: () => {},
      },
      eventHandler,
      zIndex: 0,
    });

    const rectElement = parent.getChildByLabel("rect-1");
    rectElement.emit("pointerover");
    rectElement.emit("pointerup", { button: 0 });
    rectElement.emit("pointerdown");
    rectElement.emit("globalpointermove", { global: { x: 10, y: 10 } });

    expect(rectElement.eventMode).toBe("none");
    expect(eventHandler).not.toHaveBeenCalled();
  });

  it("preserves explicitly marked editor chrome interactions", () => {
    const parent = new Container();
    const eventHandler = vi.fn();
    const element = parseRect({
      state: {
        id: "selection-handle",
        type: "rect",
        x: 0,
        y: 0,
        width: 20,
        height: 20,
        fill: "#737373",
        designInteraction: true,
        hover: { cursor: "move" },
        drag: { move: { payload: { source: "editor" } } },
      },
    });

    addRect({
      app: {
        interactionMode: "design",
        audioStage: { add: vi.fn() },
      },
      parent,
      element,
      animations: [],
      animationBus: { dispatch: vi.fn() },
      completionTracker: {
        getVersion: () => 0,
        track: () => {},
        complete: () => {},
      },
      eventHandler,
      zIndex: 0,
    });

    const rectElement = parent.getChildByLabel("selection-handle");
    rectElement.emit("pointerdown");
    rectElement.emit("globalpointermove", { global: { x: 10, y: 10 } });

    expect(rectElement.eventMode).toBe("static");
    expect(eventHandler).toHaveBeenCalledWith(
      "dragMove",
      expect.objectContaining({
        _event: expect.objectContaining({ id: "selection-handle" }),
      }),
    );
  });

  it("renders scaled rect geometry without double-applying the live scale", () => {
    const parent = new Container();
    const element = parseRect({
      state: {
        id: "rect-1",
        type: "rect",
        x: 300,
        y: 200,
        width: 220,
        height: 180,
        fill: "#737373",
        alpha: 1,
        scaleX: 1.5,
        scaleY: 0.6,
      },
    });

    addRect({
      app: {
        audioStage: { add: vi.fn() },
      },
      parent,
      element,
      animations: [],
      animationBus: { dispatch: vi.fn() },
      completionTracker: {
        getVersion: () => 0,
        track: () => {},
        complete: () => {},
      },
      eventHandler: vi.fn(),
      zIndex: 0,
    });

    const rectElement = parent.getChildByLabel("rect-1");

    expect(rectElement.scale.x).toBe(1);
    expect(rectElement.scale.y).toBe(1);
    expect(rectElement.width).toBe(element.width);
    expect(rectElement.height).toBe(element.height);
  });

  it("applies degree rotation around the computed anchor origin", () => {
    const parent = new Container();
    const element = parseRect({
      state: {
        id: "rect-1",
        type: "rect",
        x: 300,
        y: 200,
        width: 120,
        height: 80,
        anchorX: 0.5,
        anchorY: 0.5,
        fill: "#737373",
        alpha: 1,
        rotation: 90,
      },
    });

    addRect({
      app: {
        audioStage: { add: vi.fn() },
      },
      parent,
      element,
      animations: [],
      animationBus: { dispatch: vi.fn() },
      completionTracker: {
        getVersion: () => 0,
        track: () => {},
        complete: () => {},
      },
      eventHandler: vi.fn(),
      zIndex: 0,
    });

    const rectElement = parent.getChildByLabel("rect-1");

    expect(rectElement.pivot.x).toBe(60);
    expect(rectElement.pivot.y).toBe(40);
    expect(rectElement.x).toBe(300);
    expect(rectElement.y).toBe(200);
    expect(rectElement.rotation).toBeCloseTo(Math.PI / 2);
  });

  it("uses explicit origin independently from anchor for rotation", () => {
    const parent = new Container();
    const element = parseRect({
      state: {
        id: "rect-1",
        type: "rect",
        x: 300,
        y: 200,
        width: 120,
        height: 80,
        anchorX: 0.5,
        anchorY: 0.5,
        originX: 0,
        originY: 80,
        fill: "#737373",
        alpha: 1,
        rotation: 45,
      },
    });

    addRect({
      app: {
        audioStage: { add: vi.fn() },
      },
      parent,
      element,
      animations: [],
      animationBus: { dispatch: vi.fn() },
      completionTracker: {
        getVersion: () => 0,
        track: () => {},
        complete: () => {},
      },
      eventHandler: vi.fn(),
      zIndex: 0,
    });

    const rectElement = parent.getChildByLabel("rect-1");

    expect(element.x).toBe(240);
    expect(element.y).toBe(160);
    expect(rectElement.pivot.x).toBe(0);
    expect(rectElement.pivot.y).toBe(80);
    expect(rectElement.x).toBe(240);
    expect(rectElement.y).toBe(240);
    expect(rectElement.rotation).toBeCloseTo(Math.PI / 4);
  });
});
