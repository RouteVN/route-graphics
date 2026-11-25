import { Container, Texture } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { createAnimationBus } from "../../src/plugins/animations/animationBus.js";
import { containerPlugin } from "../../src/plugins/elements/container/index.js";
import { rectPlugin } from "../../src/plugins/elements/rect/index.js";
import { renderElements } from "../../src/plugins/elements/renderElements.js";

// Scrolling moves a container's children into its `*-content` container.
// Work that mounts a child later, such as a replacement waiting on cleanup or
// an element that loads before it attaches, must mount it where its siblings
// now are, and only the content container that scrolling created counts.

const container = (id, children, extra = {}) => ({
  id,
  type: "container",
  x: 0,
  y: 0,
  children,
  ...extra,
});

const box = (id, type, extra = {}) => ({
  id,
  type,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  fill: "#ffffff",
  ...extra,
});

const enter = (targetId) => ({
  id: `${targetId}-enter`,
  targetId,
  type: "transition",
  next: {
    tween: {
      alpha: {
        initialValue: 0,
        keyframes: [{ duration: 600, value: 1, easing: "linear" }],
      },
    },
  },
});

const createStage = () => {
  const gates = [];
  const waitForGate = () => new Promise((resolve) => gates.push(resolve));
  const attach = ({ parent, element, zIndex }) => {
    const node = new Container({ label: element.id });
    node.zIndex = zIndex;
    parent.addChild(node);
  };
  const remove = ({ parent, element }) => {
    parent.getChildByLabel(element.id)?.destroy({ children: true });
  };

  const plugins = [
    containerPlugin,
    rectPlugin,
    // Attaches only after it loads, as animated sprites do.
    {
      type: "loading",
      add: async (options) => {
        await waitForGate();
        if (options.signal?.aborted || options.parent.destroyed) return;
        attach(options);
      },
      update: () => {},
      delete: remove,
    },
    // Mounts at once, but its cleanup settles later.
    {
      type: "slow-delete",
      add: attach,
      update: () => {},
      delete: (options) => waitForGate().then(() => remove(options)),
    },
    // Attaches at once, but its add settles later, as text reveals do.
    {
      type: "slow-add",
      add: async (options) => {
        attach(options);
        await waitForGate();
      },
      update: () => {},
      delete: remove,
    },
  ];

  const app = {
    renderer: {
      width: 1920,
      height: 1080,
      generateTexture: vi.fn(() => Texture.WHITE),
    },
    ticker: { add: vi.fn(), remove: vi.fn() },
  };
  const root = new Container();
  const animationBus = createAnimationBus();
  const completionTracker = {
    getVersion: () => 1,
    track: vi.fn(),
    complete: vi.fn(),
    fail: vi.fn(),
  };
  let prevTree = [];
  let controller;

  const render = (nextTree, animations = []) => {
    controller?.abort();
    controller = new AbortController();
    animationBus.cancelAllExcept(new Set());
    renderElements({
      app,
      parent: root,
      prevComputedTree: prevTree,
      nextComputedTree: nextTree,
      animations,
      animationBus,
      completionTracker,
      eventHandler: vi.fn(),
      elementPlugins: plugins,
      signal: controller.signal,
    });
    animationBus.flush();
    prevTree = nextTree;
  };

  const settle = async () => {
    for (const open of gates.splice(0)) open();
    for (let turn = 0; turn < 10; turn += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  const parentsOf = (id, node = root, parents = []) => {
    for (const child of node.children) {
      if (!child.destroyed && child.label === id) {
        parents.push(child.parent.label);
      }
      parentsOf(id, child, parents);
    }
    return parents;
  };

  return { animationBus, render, settle, parentsOf };
};

describe("a container that starts scrolling in an update", () => {
  // The story fits at height 2000 and overflows at 400. Its children do not
  // change when it starts scrolling, so they are not rendered again.
  const story = (type, height) =>
    container(
      "story",
      [box("line", type), box("filler", "rect", { y: 1000 })],
      { scroll: true, width: 800, height },
    );

  it("mounts a replacement waiting on cleanup inside its content", async () => {
    const stage = createStage();
    stage.render([story("slow-delete", 2000)]);
    stage.render([story("rect", 2000)]);
    stage.render([story("rect", 400)]);
    expect(stage.parentsOf("filler")).toEqual(["story-content"]);

    await stage.settle();

    expect(stage.parentsOf("line")).toEqual(["story-content"]);
  });

  it("keeps a single replacement whose add settles later", async () => {
    const stage = createStage();
    stage.render([story("rect", 2000)]);
    stage.render([story("slow-add", 2000)]);
    stage.render([story("slow-add", 400)]);

    await stage.settle();

    expect(stage.parentsOf("line")).toEqual(["story-content"]);
  });
});

describe("a child whose id ends in -content", () => {
  it("is not taken for the content of a container that does not scroll", async () => {
    // Anchored to the bottom, but its children fit, so it creates no content
    // container of its own.
    const stage = createStage();
    stage.render(
      [
        container(
          "story",
          [
            box("story-content", "rect"),
            box("portrait", "loading", { y: 100 }),
          ],
          { anchorToBottom: true, width: 800, height: 400 },
        ),
      ],
      [enter("portrait")],
    );

    await stage.settle();
    stage.animationBus.tick(700);

    expect(stage.parentsOf("portrait")).toEqual(["story"]);
  });
});
