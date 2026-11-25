import { Container, Texture } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { createAnimationBus } from "../../src/plugins/animations/animationBus.js";
import { containerPlugin } from "../../src/plugins/elements/container/index.js";
import { rectPlugin } from "../../src/plugins/elements/rect/index.js";
import { renderElements } from "../../src/plugins/elements/renderElements.js";

// A visual novel scene mounts in one render: a story container holds a click
// area and a character portrait that fades in. Children of a container that
// mounts in the same render must stay in that container, whatever their
// siblings mount first, both while the portrait fades in and after the next
// line renders the same scene without the transition. A scrolling or
// bottom-anchored story keeps the portrait in its scrolled, clipped content.

const rect = (id) => ({
  id,
  type: "rect",
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  fill: "#ffffff",
});

const container = (id, children, extra = {}) => ({
  id,
  type: "container",
  x: 0,
  y: 0,
  children,
  ...extra,
});

// Computed containers carry their size, which scrolling measures.
const portrait = container("portrait", [rect("portrait-base")], {
  x: 520,
  y: 1080,
  width: 100,
  height: 100,
  anchorX: 0.5,
  anchorY: 1,
});
const clickArea = container("click-area", [rect("click-area-hit")], {
  width: 100,
  height: 100,
});

const enterPortrait = {
  id: "portrait-enter",
  targetId: "portrait",
  type: "transition",
  next: {
    tween: {
      alpha: {
        initialValue: 0,
        keyframes: [{ duration: 600, value: 1, easing: "linear" }],
      },
    },
  },
};

// A composite element that renders its children into an internal slot, the
// way custom plugins built on renderElements do.
const slottedPlugin = {
  type: "slotted",
  add: (options) => {
    const owner = new Container({ label: options.element.id });
    const slot = new Container({ label: `${options.element.id}-slot` });
    owner.addChild(slot);
    options.parent.addChild(owner);
    return renderElements({
      ...options,
      parent: slot,
      prevComputedTree: [],
      nextComputedTree: options.element.children,
    });
  },
  update: (options) => {
    const owner = options.parent.getChildByLabel(options.prevElement.id);
    return renderElements({
      ...options,
      parent: owner.getChildByLabel(`${options.prevElement.id}-slot`),
      prevComputedTree: options.prevElement.children,
      nextComputedTree: options.nextElement.children,
    });
  },
  delete: ({ parent, element }) => {
    parent.getChildByLabel(element.id)?.destroy({ children: true });
  },
};

const createStage = () => {
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

  // Mirrors a host render: animations the next state does not continue are
  // cancelled before the element tree is reconciled.
  const render = (nextTree, animations = []) => {
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
      elementPlugins: [containerPlugin, rectPlugin, slottedPlugin],
      signal: new AbortController().signal,
    });
    animationBus.flush();
    prevTree = nextTree;
  };

  // The label of the nearest ancestor that is an element, skipping internal
  // display objects such as a composite's slot.
  const getOwnerLabel = (id, elementIds) => {
    const node = root.getChildByLabel(id, true);
    for (let parent = node?.parent; parent; parent = parent.parent) {
      if (parent === root) return "root";
      if (elementIds.includes(parent.label)) return parent.label;
    }
    return undefined;
  };

  return { root, animationBus, render, getOwnerLabel };
};

const scenes = [
  {
    name: "a container sibling mounts before the portrait",
    tree: [container("story", [clickArea, portrait])],
    owner: "story",
    parent: "story",
  },
  {
    name: "a container sibling mounts after the portrait",
    tree: [container("story", [portrait, clickArea])],
    owner: "story",
    parent: "story",
  },
  {
    name: "the portrait is nested two containers deep",
    tree: [
      container("story", [
        clickArea,
        container("stage", [container("backdrop", [rect("sky")]), portrait]),
      ]),
    ],
    owner: "stage",
    parent: "stage",
  },
  {
    name: "a composite element renders the portrait into its slot",
    tree: [
      {
        id: "story",
        type: "slotted",
        x: 0,
        y: 0,
        children: [clickArea, portrait],
      },
    ],
    owner: "story",
    parent: "story-slot",
  },
  {
    name: "the story scrolls its overflowing content",
    tree: [
      container("story", [clickArea, portrait], {
        scroll: true,
        width: 1920,
        height: 600,
      }),
    ],
    owner: "story",
    parent: "story-content",
  },
  {
    name: "the story anchors its overflowing content to the bottom",
    tree: [
      container("story", [portrait, clickArea], {
        anchorToBottom: true,
        width: 1920,
        height: 600,
      }),
    ],
    owner: "story",
    parent: "story-content",
  },
];
const elementIds = ["story", "stage", "backdrop", "click-area", "portrait"];

describe("an element that enters inside a container mounting in the same render", () => {
  describe.each(scenes)("when $name", ({ tree, owner, parent }) => {
    it("fades in inside its container", () => {
      const stage = createStage();

      stage.render(tree, [enterPortrait]);

      expect(stage.getOwnerLabel("portrait", elementIds)).toBe(owner);
      expect(stage.root.children.map((child) => child.label)).toEqual([
        "story",
      ]);

      stage.animationBus.tick(600);

      const shown = stage.root.getChildByLabel("portrait", true);
      expect(stage.getOwnerLabel("portrait", elementIds)).toBe(owner);
      expect(shown.parent.label).toBe(parent);
      expect(shown.visible).toBe(true);
      expect(shown.alpha).toBe(1);
    });

    it.each([
      ["after the transition completes", 700],
      ["during the transition", 300],
      ["as the transition starts", 0],
    ])("stays visible when the next render follows %s", (_, elapsedMS) => {
      const stage = createStage();

      stage.render(tree, [enterPortrait]);
      if (elapsedMS > 0) stage.animationBus.tick(elapsedMS);
      stage.render(tree);
      stage.animationBus.tick(600);

      const shown = stage.root.getChildByLabel("portrait", true);
      expect(shown?.destroyed).toBe(false);
      expect(stage.getOwnerLabel("portrait", elementIds)).toBe(owner);
      expect(shown.parent.label).toBe(parent);
      expect(shown.visible).toBe(true);
      expect(shown.alpha).toBe(1);
      expect(shown.getChildByLabel("portrait-base")).toBeTruthy();
      expect(stage.root.children.map((child) => child.label)).toEqual([
        "story",
      ]);
    });
  });
});
