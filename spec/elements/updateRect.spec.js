import { Container, Graphics } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import { updateRect } from "../../src/plugins/elements/rect/updateRect.js";
import { parseRect } from "../../src/plugins/elements/rect/parseRect.js";

describe("updateRect", () => {
  it("resets transient rect scale when returning to an unscaled state", () => {
    const parent = new Container();
    const rectElement = new Graphics();
    rectElement.label = "rect-1";
    rectElement.scale.set(1.5, 1.5);
    parent.addChild(rectElement);

    updateRect({
      app: {
        audioStage: { add: vi.fn() },
      },
      parent,
      prevElement: {
        id: "rect-1",
        type: "rect",
        x: 300,
        y: 200,
        width: 200,
        height: 200,
        fill: "#737373",
        alpha: 1,
        scaleX: 1.5,
        scaleY: 1.5,
      },
      nextElement: {
        id: "rect-1",
        type: "rect",
        x: 300,
        y: 200,
        width: 200,
        height: 200,
        fill: "#737373",
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
      },
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

    expect(rectElement.scale.x).toBe(1);
    expect(rectElement.scale.y).toBe(1);
  });

  it("dispatches auto scale tweens from parsed rect scale values", () => {
    const parent = new Container();
    const rectElement = new Graphics();
    rectElement.label = "rect-1";
    parent.addChild(rectElement);

    const animationBus = { dispatch: vi.fn() };
    const prevElement = parseRect({
      state: {
        id: "rect-1",
        type: "rect",
        x: 300,
        y: 200,
        width: 200,
        height: 200,
        fill: "#737373",
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
      },
    });
    const nextElement = parseRect({
      state: {
        id: "rect-1",
        type: "rect",
        x: 300,
        y: 200,
        width: 200,
        height: 200,
        fill: "#737373",
        alpha: 1,
        scaleX: 1.5,
        scaleY: 0.6,
      },
    });

    updateRect({
      app: {
        audioStage: { add: vi.fn() },
      },
      parent,
      prevElement,
      nextElement,
      animations: [
        {
          id: "rect-scale-auto",
          targetId: "rect-1",
          type: "update",
          tween: {
            scaleX: {
              auto: {
                duration: 300,
                easing: "linear",
              },
            },
            scaleY: {
              auto: {
                duration: 300,
                easing: "linear",
              },
            },
          },
        },
      ],
      animationBus,
      completionTracker: {
        getVersion: vi.fn().mockReturnValue(1),
        track: vi.fn(),
        complete: vi.fn(),
      },
      eventHandler: vi.fn(),
      zIndex: 0,
    });

    expect(animationBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "START",
        payload: expect.objectContaining({
          id: "rect-scale-auto",
          targetState: expect.objectContaining({
            scaleX: 1.5,
            scaleY: 0.6,
          }),
        }),
      }),
    );
  });

  it("flattens rect scale back into geometry when an update animation completes", () => {
    const parent = new Container();
    const rectElement = new Graphics();
    rectElement.label = "rect-1";
    parent.addChild(rectElement);

    const animationBus = { dispatch: vi.fn() };
    const prevElement = parseRect({
      state: {
        id: "rect-1",
        type: "rect",
        x: 300,
        y: 200,
        width: 220,
        height: 180,
        fill: "#737373",
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
      },
    });
    const nextElement = parseRect({
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

    updateRect({
      app: {
        audioStage: { add: vi.fn() },
      },
      parent,
      prevElement,
      nextElement,
      animations: [
        {
          id: "rect-scale-auto",
          targetId: "rect-1",
          type: "update",
          tween: {
            scaleX: {
              auto: {
                duration: 300,
                easing: "linear",
              },
            },
            scaleY: {
              auto: {
                duration: 300,
                easing: "linear",
              },
            },
          },
        },
      ],
      animationBus,
      completionTracker: {
        getVersion: vi.fn().mockReturnValue(1),
        track: vi.fn(),
        complete: vi.fn(),
      },
      eventHandler: vi.fn(),
      zIndex: 0,
    });

    const dispatchPayload = animationBus.dispatch.mock.calls[0][0].payload;

    rectElement.scale.set(1.5, 0.6);
    dispatchPayload.onComplete();

    expect(rectElement.scale.x).toBe(1);
    expect(rectElement.scale.y).toBe(1);
    expect(rectElement.width).toBe(nextElement.width);
    expect(rectElement.height).toBe(nextElement.height);
  });

  it("applies updated rotation around the computed anchor origin", () => {
    const parent = new Container();
    const rectElement = new Graphics();
    rectElement.label = "rect-1";
    parent.addChild(rectElement);

    const prevElement = parseRect({
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
        rotation: 0,
      },
    });
    const nextElement = parseRect({
      state: {
        id: "rect-1",
        type: "rect",
        x: 320,
        y: 240,
        width: 120,
        height: 80,
        anchorX: 0.5,
        anchorY: 0.5,
        fill: "#737373",
        alpha: 1,
        rotation: 90,
      },
    });

    updateRect({
      app: {
        audioStage: { add: vi.fn() },
      },
      parent,
      prevElement,
      nextElement,
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

    expect(rectElement.pivot.x).toBe(60);
    expect(rectElement.pivot.y).toBe(40);
    expect(rectElement.x).toBe(320);
    expect(rectElement.y).toBe(240);
    expect(rectElement.rotation).toBeCloseTo(Math.PI / 2);
  });

  it("uses explicit origin independently from anchor when applying rotation", () => {
    const parent = new Container();
    const rectElement = new Graphics();
    rectElement.label = "rect-1";
    parent.addChild(rectElement);

    const prevElement = parseRect({
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
        rotation: 0,
      },
    });
    const nextElement = parseRect({
      state: {
        id: "rect-1",
        type: "rect",
        x: 320,
        y: 240,
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

    updateRect({
      app: {
        audioStage: { add: vi.fn() },
      },
      parent,
      prevElement,
      nextElement,
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

    expect(nextElement.x).toBe(260);
    expect(nextElement.y).toBe(200);
    expect(rectElement.pivot.x).toBe(0);
    expect(rectElement.pivot.y).toBe(80);
    expect(rectElement.x).toBe(260);
    expect(rectElement.y).toBe(280);
    expect(rectElement.rotation).toBeCloseTo(Math.PI / 4);
  });

  it("dispatches auto rotation tweens with degree target values", () => {
    const parent = new Container();
    const rectElement = new Graphics();
    rectElement.label = "rect-1";
    parent.addChild(rectElement);

    const animationBus = { dispatch: vi.fn() };
    const prevElement = parseRect({
      state: {
        id: "rect-1",
        type: "rect",
        x: 300,
        y: 200,
        width: 120,
        height: 80,
        fill: "#737373",
        alpha: 1,
        rotation: 0,
      },
    });
    const nextElement = parseRect({
      state: {
        id: "rect-1",
        type: "rect",
        x: 300,
        y: 200,
        width: 120,
        height: 80,
        fill: "#737373",
        alpha: 1,
        rotation: 90,
      },
    });

    updateRect({
      app: {
        audioStage: { add: vi.fn() },
      },
      parent,
      prevElement,
      nextElement,
      animations: [
        {
          id: "rect-rotation-auto",
          targetId: "rect-1",
          type: "update",
          tween: {
            rotation: {
              auto: {
                duration: 300,
                easing: "linear",
              },
            },
          },
        },
      ],
      animationBus,
      completionTracker: {
        getVersion: vi.fn().mockReturnValue(1),
        track: vi.fn(),
        complete: vi.fn(),
      },
      eventHandler: vi.fn(),
      zIndex: 0,
    });

    expect(animationBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "START",
        payload: expect.objectContaining({
          id: "rect-rotation-auto",
          targetState: expect.objectContaining({
            rotation: 90,
          }),
        }),
      }),
    );
  });

  it("dispatches auto transform targets using explicit origin coordinates", () => {
    const parent = new Container();
    const rectElement = new Graphics();
    rectElement.label = "rect-1";
    parent.addChild(rectElement);

    const animationBus = { dispatch: vi.fn() };
    const prevElement = parseRect({
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
        rotation: 0,
      },
    });
    const nextElement = parseRect({
      state: {
        id: "rect-1",
        type: "rect",
        x: 320,
        y: 240,
        width: 120,
        height: 80,
        anchorX: 0.5,
        anchorY: 0.5,
        originX: 0,
        originY: 80,
        fill: "#737373",
        alpha: 1,
        rotation: 90,
      },
    });

    updateRect({
      app: {
        audioStage: { add: vi.fn() },
      },
      parent,
      prevElement,
      nextElement,
      animations: [
        {
          id: "rect-transform-auto",
          targetId: "rect-1",
          type: "update",
          tween: {
            x: {
              auto: {
                duration: 300,
                easing: "linear",
              },
            },
            y: {
              auto: {
                duration: 300,
                easing: "linear",
              },
            },
            rotation: {
              auto: {
                duration: 300,
                easing: "linear",
              },
            },
          },
        },
      ],
      animationBus,
      completionTracker: {
        getVersion: vi.fn().mockReturnValue(1),
        track: vi.fn(),
        complete: vi.fn(),
      },
      eventHandler: vi.fn(),
      zIndex: 0,
    });

    expect(animationBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "START",
        payload: expect.objectContaining({
          id: "rect-transform-auto",
          targetState: expect.objectContaining({
            x: 260,
            y: 280,
            rotation: 90,
          }),
        }),
      }),
    );
  });

  it("applies hover sound volume after rebinding interactions", () => {
    const parent = new Container();
    const rectElement = new Graphics();
    const audioStage = { add: vi.fn() };
    rectElement.label = "rect-1";
    parent.addChild(rectElement);
    const prevElement = parseRect({
      state: {
        id: "rect-1",
        type: "rect",
        x: 0,
        y: 0,
        width: 120,
        height: 80,
        fill: "#737373",
        alpha: 1,
      },
    });
    const nextElement = parseRect({
      state: {
        id: "rect-1",
        type: "rect",
        x: 0,
        y: 0,
        width: 120,
        height: 80,
        fill: "#737373",
        alpha: 1,
        hover: {
          soundSrc: "hover.mp3",
          soundVolume: 45,
        },
      },
    });

    updateRect({
      app: { audioStage },
      parent,
      prevElement,
      nextElement,
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

    rectElement.emit("pointerover");

    expect(audioStage.add).toHaveBeenCalledWith({
      id: expect.stringMatching(/^hover-/),
      url: "hover.mp3",
      loop: false,
      volume: 0.45,
    });
  });
});
