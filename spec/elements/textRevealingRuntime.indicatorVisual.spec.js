import { AnimatedSprite, Cache, Container, Texture } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { parseTextRevealing } from "../../src/plugins/elements/text-revealing/parseTextRevealing.js";
import { runTextReveal } from "../../src/plugins/elements/text-revealing/textRevealingRuntime.js";
import { getCharacterXPositionInATextObject } from "../../src/util/getCharacterXPositionInATextObject.js";

const createCompletionTracker = () => ({
  getVersion: () => 0,
  track: vi.fn(),
  complete: vi.fn(),
});

const getRenderedText = (container) => {
  const textParts = [];
  const visit = (node) => {
    if (typeof node?.text === "string") {
      textParts.push(node.text);
    }

    if (Array.isArray(node?.children)) {
      node.children.forEach(visit);
    }
  };

  visit(container);

  return textParts.join("");
};

const getLastRenderedTextObject = (container) => {
  let lastTextObject;
  const visit = (node) => {
    if (typeof node?.text === "string") {
      lastTextObject = node;
    }

    if (Array.isArray(node?.children)) {
      node.children.forEach(visit);
    }
  };

  visit(container);
  return lastTextObject;
};

let textureIndex = 0;
const createTextureId = (prefix) => {
  textureIndex += 1;
  const id = `${prefix}-${textureIndex}`;
  const texture = new Texture({
    source: Texture.WHITE.source,
    label: id,
  });

  Cache.set(id, texture);

  return id;
};

const createAtlas = () => ({
  frames: {
    "indicator-0": {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    },
    "indicator-1": {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    },
  },
});

const createElement = (indicator, overrides = {}) =>
  parseTextRevealing({
    state: {
      id: "line-1",
      type: "text-revealing",
      x: 0,
      y: 0,
      width: 500,
      speed: 25,
      revealEffect: "typewriter",
      content: [{ text: "Indicator visuals can be animated." }],
      textStyle: {
        fontSize: 20,
        fontFamily: "Arial",
        breakWords: false,
      },
      indicator,
      ...overrides,
    },
  });

const runReveal = async (element, playback = "paused-initial") => {
  const container = new Container();
  const completionTracker = createCompletionTracker();
  const animationBus = { dispatch: vi.fn() };

  await runTextReveal({
    container,
    element,
    completionTracker,
    animationBus,
    zIndex: 0,
    signal: new AbortController().signal,
    playback,
  });

  return { container, completionTracker, animationBus };
};

const getExpectedIndicatorY = (chunk, indicator, offsetY = 0) =>
  chunk.y + Math.max(0, chunk.lineMaxHeight - indicator.height) + offsetY;

describe("runTextReveal indicator visuals", () => {
  it("mounts a spritesheet revealing indicator as an AnimatedSprite", async () => {
    const sheetSrc = createTextureId("revealing-indicator-sheet");
    const element = createElement({
      revealing: {
        kind: "spritesheet",
        src: sheetSrc,
        width: 18,
        height: 18,
        atlas: createAtlas(),
        playback: {
          frames: ["indicator-0", "indicator-1"],
          fps: 9,
          loop: true,
          autoplay: false,
        },
      },
    });

    const { container, completionTracker } = await runReveal(
      element,
      "paused-initial",
    );
    const indicator = container.getChildByLabel("line-1-indicator");
    const visual = indicator.children[0];

    expect(visual).toBeInstanceOf(AnimatedSprite);
    expect(visual.textures).toHaveLength(2);
    expect(visual.animationSpeed).toBe(9 / 60);
    expect(visual.loop).toBe(true);
    expect(visual.width).toBe(18);
    expect(visual.height).toBe(18);
    expect(completionTracker.track).toHaveBeenCalledTimes(1);
    expect(completionTracker.complete).toHaveBeenCalledTimes(1);
  });

  it("applies indicator offsetX and offsetY", async () => {
    const element = createElement({
      revealing: {
        width: 10,
        height: 6,
      },
      offsetX: 23,
      offsetY: -5,
    });

    const { container } = await runReveal(element, "paused-initial");
    const indicator = container.getChildByLabel("line-1-indicator");
    const firstLine = element.content[0];

    expect(indicator.x).toBe(23);
    expect(indicator.y).toBeCloseTo(
      getExpectedIndicatorY(firstLine, indicator, -5),
    );
  });

  it("applies visual-specific offsets for revealing and complete indicators", async () => {
    const completeSrc = createTextureId("complete-offset-visual");
    const revealingElement = createElement({
      revealing: {
        width: 10,
        height: 6,
        offsetX: 7,
        offsetY: 3,
      },
      complete: {
        kind: "image",
        src: completeSrc,
        width: 10,
        height: 6,
        offsetX: 31,
        offsetY: -8,
      },
      offsetX: 99,
      offsetY: 99,
    });

    const revealingResult = await runReveal(revealingElement, "paused-initial");
    const revealingIndicator =
      revealingResult.container.getChildByLabel("line-1-indicator");
    const firstLine = revealingElement.content[0];

    expect(revealingIndicator.x).toBe(7);
    expect(revealingIndicator.y).toBeCloseTo(
      getExpectedIndicatorY(firstLine, revealingIndicator, 3),
    );

    const completeElement = createElement(
      {
        revealing: {
          width: 10,
          height: 6,
          offsetX: 7,
          offsetY: 3,
        },
        complete: {
          kind: "image",
          src: completeSrc,
          width: 10,
          height: 6,
          offsetX: 31,
          offsetY: -8,
        },
        offsetX: 99,
        offsetY: 99,
      },
      {
        content: [{ text: "Complete" }],
        revealEffect: "none",
      },
    );

    const completeResult = await runReveal(completeElement, "autoplay");
    const completeIndicator =
      completeResult.container.getChildByLabel("line-1-indicator");
    const completeLine = completeElement.content[0];
    const completeTextObject = getLastRenderedTextObject(
      completeResult.container,
    );

    expect(completeIndicator.x).toBeCloseTo(
      getCharacterXPositionInATextObject(
        completeTextObject,
        completeTextObject.text.length - 1,
      ) + 31,
    );
    expect(completeIndicator.y).toBeCloseTo(
      getExpectedIndicatorY(completeLine, completeIndicator, -8),
    );
  });

  it("keeps a tall revealing indicator inside the active line by default", async () => {
    const element = createElement({
      revealing: {
        width: 10,
        height: 60,
      },
    });

    const { container } = await runReveal(element, "paused-initial");
    const indicator = container.getChildByLabel("line-1-indicator");
    const firstLine = element.content[0];

    expect(indicator.height).toBe(60);
    expect(indicator.y).toBeCloseTo(firstLine.y);
  });

  it("repositions a smaller complete indicator after a tall revealing visual", async () => {
    const completeSrc = createTextureId("complete-small-after-tall-revealing");
    const element = createElement(
      {
        revealing: {
          width: 10,
          height: 60,
        },
        complete: {
          kind: "image",
          src: completeSrc,
          width: 10,
          height: 10,
        },
      },
      {
        revealEffect: "none",
      },
    );

    const { container } = await runReveal(element, "autoplay");
    const indicator = container.getChildByLabel("line-1-indicator");
    const firstLine = element.content[0];

    expect(indicator.height).toBe(10);
    expect(indicator.y).toBeCloseTo(
      getExpectedIndicatorY(firstLine, indicator),
    );
  });

  it("keeps a taller complete indicator inside the final line after swapping visuals", async () => {
    const completeSrc = createTextureId("complete-tall-after-small-revealing");
    const element = createElement(
      {
        revealing: {
          width: 10,
          height: 10,
        },
        complete: {
          kind: "image",
          src: completeSrc,
          width: 10,
          height: 60,
        },
      },
      {
        revealEffect: "none",
      },
    );

    const { container } = await runReveal(element, "autoplay");
    const indicator = container.getChildByLabel("line-1-indicator");
    const firstLine = element.content[0];

    expect(indicator.height).toBe(60);
    expect(indicator.y).toBeCloseTo(firstLine.y);
  });

  it("mounts a spritesheet revealing indicator during softWipe playback", async () => {
    const sheetSrc = createTextureId("soft-wipe-revealing-indicator-sheet");
    const completeSrc = createTextureId("soft-wipe-complete-indicator-image");
    const element = createElement(
      {
        revealing: {
          kind: "spritesheet",
          src: sheetSrc,
          width: 18,
          height: 18,
          atlas: createAtlas(),
          playback: {
            frames: ["indicator-0", "indicator-1"],
            fps: 9,
            loop: true,
            autoplay: false,
          },
        },
        complete: {
          kind: "image",
          src: completeSrc,
          width: 12,
          height: 12,
        },
      },
      {
        revealEffect: "softWipe",
      },
    );
    const container = new Container();
    const completionTracker = createCompletionTracker();
    const animationBus = { dispatch: vi.fn() };

    await runTextReveal({
      container,
      element,
      completionTracker,
      animationBus,
      zIndex: 0,
      signal: new AbortController().signal,
      playback: "autoplay",
    });

    const indicator = container.getChildByLabel("line-1-indicator");
    const visual = indicator.children[0];
    const startAction = animationBus.dispatch.mock.calls.find(
      ([action]) => action.type === "START",
    )?.[0];

    expect(visual).toBeInstanceOf(AnimatedSprite);
    expect(visual.textures).toHaveLength(2);
    expect(startAction?.payload).toBeDefined();

    startAction.payload.onCancel();
  });

  it("swaps an image revealing indicator to a spritesheet complete indicator", async () => {
    const revealingSrc = createTextureId("revealing-indicator-image");
    const completeSrc = createTextureId("complete-indicator-sheet");
    const element = createElement(
      {
        revealing: {
          kind: "image",
          src: revealingSrc,
          width: 12,
          height: 12,
        },
        complete: {
          kind: "spritesheet",
          src: completeSrc,
          width: 16,
          height: 16,
          atlas: createAtlas(),
          playback: {
            frames: ["indicator-1"],
            fps: 15,
            loop: false,
            autoplay: false,
          },
        },
      },
      {
        revealEffect: "none",
      },
    );

    const { container, completionTracker } = await runReveal(
      element,
      "autoplay",
    );
    const indicator = container.getChildByLabel("line-1-indicator");
    const visual = indicator.children[0];

    expect(visual).toBeInstanceOf(AnimatedSprite);
    expect(visual.textures).toHaveLength(1);
    expect(visual.animationSpeed).toBe(15 / 60);
    expect(visual.loop).toBe(false);
    expect(visual.width).toBe(16);
    expect(visual.height).toBe(16);
    expect(completionTracker.track).toHaveBeenCalledTimes(2);
    expect(completionTracker.complete).toHaveBeenCalledTimes(2);
  });

  it("keeps the revealing indicator active for the final typewriter frame", async () => {
    vi.useFakeTimers();

    try {
      const sheetSrc = createTextureId("revealing-final-frame-sheet");
      const completeSrc = createTextureId("complete-final-frame-image");
      const element = createElement(
        {
          revealing: {
            kind: "spritesheet",
            src: sheetSrc,
            width: 18,
            height: 18,
            atlas: createAtlas(),
            playback: {
              frames: ["indicator-0", "indicator-1"],
              fps: 9,
              loop: true,
              autoplay: false,
            },
          },
          complete: {
            kind: "image",
            src: completeSrc,
            width: 12,
            height: 12,
          },
        },
        {
          speed: 0,
          content: [
            {
              text: "AB",
              textStyle: {
                fontSize: 20,
                fontFamily: "Arial",
                breakWords: false,
              },
            },
          ],
        },
      );
      const container = new Container();
      const completionTracker = createCompletionTracker();
      const reveal = runTextReveal({
        container,
        element,
        completionTracker,
        animationBus: { dispatch: vi.fn() },
        zIndex: 0,
        signal: new AbortController().signal,
        playback: "autoplay",
      });

      await vi.advanceTimersByTimeAsync(0);

      const indicator = container.getChildByLabel("line-1-indicator");

      expect(indicator.children[0]).toBeInstanceOf(AnimatedSprite);

      await vi.advanceTimersByTimeAsync(100);

      expect(getRenderedText(container)).toBe("AB");
      expect(indicator.children[0]).toBeInstanceOf(AnimatedSprite);

      await vi.advanceTimersByTimeAsync(99);

      expect(indicator.children[0]).toBeInstanceOf(AnimatedSprite);

      await vi.advanceTimersByTimeAsync(1);
      await reveal;

      expect(indicator.children[0]).not.toBeInstanceOf(AnimatedSprite);
      expect(indicator.children[0].width).toBe(12);
    } finally {
      vi.useRealTimers();
    }
  });
});
