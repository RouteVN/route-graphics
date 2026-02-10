import { Container } from "pixi.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
});
