import { Container, Rectangle } from "pixi.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/plugins/elements/renderElements.js", () => ({
  renderElements: vi.fn(),
}));

import { renderElements } from "../../src/plugins/elements/renderElements.js";
import { addContainer } from "../../src/plugins/elements/container/addContainer.js";
import { createRenderContext } from "../../src/plugins/elements/renderContext.js";

describe("addContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes fresh child mounts through renderElements", () => {
    const parent = new Container();
    const renderContext = createRenderContext();

    addContainer({
      app: { audioStage: { add: vi.fn() } },
      parent,
      element: {
        id: "container-1",
        type: "container",
        x: 0,
        y: 0,
        alpha: 1,
        children: [
          {
            id: "child-1",
            type: "rect",
            x: 0,
            y: 0,
            width: 20,
            height: 20,
          },
        ],
      },
      animations: [{ id: "child-enter", targetId: "child-1", type: "transition" }],
      eventHandler: vi.fn(),
      animationBus: { dispatch: vi.fn() },
      elementPlugins: [],
      renderContext,
      zIndex: 0,
      completionTracker: {
        getVersion: () => 0,
        track: () => {},
        complete: () => {},
      },
      signal: new AbortController().signal,
    });

    expect(renderElements).toHaveBeenCalledTimes(1);
    expect(renderElements).toHaveBeenCalledWith(
      expect.objectContaining({
        prevComputedTree: [],
        nextComputedTree: [
          expect.objectContaining({
            id: "child-1",
          }),
        ],
        renderContext,
      }),
    );
  });

  it("falls back to direct child add when sibling ids are duplicated", () => {
    const parent = new Container();
    const renderContext = createRenderContext();
    const childPlugin = {
      type: "rect",
      add: vi.fn(),
    };

    addContainer({
      app: { audioStage: { add: vi.fn() } },
      parent,
      element: {
        id: "container-1",
        type: "container",
        x: 0,
        y: 0,
        alpha: 1,
        children: [
          {
            id: "child-1",
            type: "rect",
            x: 0,
            y: 0,
            width: 20,
            height: 20,
          },
          {
            id: "child-1",
            type: "rect",
            x: 25,
            y: 0,
            width: 20,
            height: 20,
          },
        ],
      },
      animations: [{ id: "child-enter", targetId: "child-1", type: "transition" }],
      eventHandler: vi.fn(),
      animationBus: { dispatch: vi.fn() },
      elementPlugins: [childPlugin],
      renderContext,
      zIndex: 0,
      completionTracker: {
        getVersion: () => 0,
        track: () => {},
        complete: () => {},
      },
      signal: new AbortController().signal,
    });

    expect(renderElements).not.toHaveBeenCalled();
    expect(childPlugin.add).toHaveBeenCalledTimes(2);
    expect(childPlugin.add.mock.calls[0][0].animations).toEqual([]);
    expect(childPlugin.add.mock.calls[1][0].animations).toEqual([]);
  });

  it("assigns a rectangular hit area to non-scroll containers with pointer interactions", () => {
    const parent = new Container();
    const renderContext = createRenderContext();
    const interactionVariants = [
      { hover: { payload: { source: "hover" } } },
      { click: { payload: { source: "click" } } },
      { rightClick: { payload: { source: "rightClick" } } },
    ];

    interactionVariants.forEach((interaction, index) => {
      addContainer({
        app: { audioStage: { add: vi.fn() } },
        parent,
        element: {
          id: `container-${index + 1}`,
          type: "container",
          x: 0,
          y: 0,
          width: 150,
          height: 90,
          alpha: 1,
          children: [],
          ...interaction,
        },
        animations: [],
        eventHandler: vi.fn(),
        animationBus: { dispatch: vi.fn() },
        elementPlugins: [],
        renderContext,
        zIndex: 0,
        completionTracker: {
          getVersion: () => 0,
          track: () => {},
          complete: () => {},
        },
        signal: new AbortController().signal,
      });

      const container = parent.getChildByLabel(`container-${index + 1}`);

      expect(container.eventMode).toBe("static");
      expect(container.hitArea).toBeInstanceOf(Rectangle);
      expect(container.hitArea.width).toBe(150);
      expect(container.hitArea.height).toBe(90);
    });
  });
});
