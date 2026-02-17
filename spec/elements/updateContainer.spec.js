import { Container } from "pixi.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupScrolling } from "../../src/plugins/elements/container/util/scrollingUtils.js";

vi.mock("../../src/plugins/elements/renderElements.js", () => ({
  renderElements: vi.fn(),
}));

import { renderElements } from "../../src/plugins/elements/renderElements.js";
import { updateContainer } from "../../src/plugins/elements/container/updateContainer.js";

describe("updateContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders into container when scroll is enabled but content does not overflow", () => {
    const parent = new Container();
    const containerElement = new Container();
    containerElement.label = "container-1";
    parent.addChild(containerElement);

    const prevElement = {
      id: "container-1",
      type: "container",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      alpha: 1,
      scroll: true,
      children: [],
    };

    const nextElement = {
      ...prevElement,
      children: [
        {
          id: "child-1",
          type: "rect",
          x: 0,
          y: 0,
          width: 50,
          height: 50,
        },
      ],
    };

    updateContainer({
      app: { audioStage: { add: vi.fn() } },
      parent,
      prevElement,
      nextElement,
      eventHandler: vi.fn(),
      animations: [],
      animationBus: { dispatch: vi.fn() },
      elementPlugins: [],
      zIndex: 0,
      completionTracker: {
        getVersion: () => 0,
        track: () => {},
        complete: () => {},
      },
      signal: new AbortController().signal,
    });

    expect(renderElements).toHaveBeenCalledTimes(1);
    expect(renderElements.mock.calls[0][0].parent).toBe(containerElement);
  });

  it("rebuilds scrolling and anchors to bottom when messages are appended", () => {
    const parent = new Container();
    const containerElement = new Container();
    containerElement.label = "container-1";
    parent.addChild(containerElement);

    const prevElement = {
      id: "container-1",
      type: "container",
      x: 0,
      y: 0,
      width: 100,
      height: 200,
      alpha: 1,
      scroll: true,
      anchorToBottom: true,
      children: [
        {
          id: "message-1",
          type: "rect",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        },
        {
          id: "message-2",
          type: "rect",
          x: 0,
          y: 105,
          width: 100,
          height: 100,
        },
        {
          id: "message-3",
          type: "rect",
          x: 0,
          y: 210,
          width: 100,
          height: 100,
        },
      ],
    };

    const nextElement = {
      ...prevElement,
      children: [
        ...prevElement.children,
        {
          id: "message-4",
          type: "rect",
          x: 0,
          y: 315,
          width: 100,
          height: 100,
        },
      ],
    };

    for (const child of prevElement.children) {
      const childContainer = new Container();
      childContainer.label = child.id;
      containerElement.addChild(childContainer);
    }

    setupScrolling({
      container: containerElement,
      element: prevElement,
    });

    const previousContentContainer = containerElement.children.find(
      (child) => child.label === "container-1-content",
    );
    expect(previousContentContainer).toBeDefined();
    expect(previousContentContainer.y).toBe(-110);

    updateContainer({
      app: { audioStage: { add: vi.fn() } },
      parent,
      prevElement,
      nextElement,
      eventHandler: vi.fn(),
      animations: [],
      animationBus: { dispatch: vi.fn() },
      elementPlugins: [],
      zIndex: 0,
      completionTracker: {
        getVersion: () => 0,
        track: () => {},
        complete: () => {},
      },
      signal: new AbortController().signal,
    });

    const nextContentContainer = containerElement.children.find(
      (child) => child.label === "container-1-content",
    );

    expect(nextContentContainer).toBeDefined();
    expect(nextContentContainer).not.toBe(previousContentContainer);
    expect(nextContentContainer.y).toBe(-215);
    expect(renderElements).toHaveBeenCalledTimes(1);
    expect(renderElements.mock.calls[0][0].parent).toBe(nextContentContainer);
  });
});
