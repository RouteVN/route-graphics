import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import { setupScrolling } from "../../src/plugins/elements/container/util/scrollingUtils.js";

const createScrollableElement = () => ({
  id: "inventory",
  type: "container",
  x: 0,
  y: 0,
  width: 100,
  height: 120,
  alpha: 1,
  scroll: true,
  scrollbar: {
    vertical: {
      thickness: 16,
      track: {
        src: "scroll-track",
        hoverSrc: "scroll-track-hover",
        pressSrc: "scroll-track-press",
      },
      thumb: {
        src: "scroll-thumb",
        hoverSrc: "scroll-thumb-hover",
        pressSrc: "scroll-thumb-press",
      },
      startButton: {
        src: "scroll-arrow-up",
        hoverSrc: "scroll-arrow-up-hover",
        pressSrc: "scroll-arrow-up-press",
        size: 16,
        step: 24,
      },
      endButton: {
        src: "scroll-arrow-down",
        hoverSrc: "scroll-arrow-down-hover",
        pressSrc: "scroll-arrow-down-press",
        size: 16,
        step: 24,
      },
    },
  },
  children: [
    {
      id: "item-1",
      type: "rect",
      x: 0,
      y: 0,
      width: 80,
      height: 60,
    },
    {
      id: "item-2",
      type: "rect",
      x: 0,
      y: 65,
      width: 80,
      height: 60,
    },
    {
      id: "item-3",
      type: "rect",
      x: 0,
      y: 130,
      width: 80,
      height: 60,
    },
  ],
});

const seedContainerChildren = ({ container, element }) => {
  for (const child of element.children) {
    const childContainer = new Container();
    childContainer.label = child.id;
    container.addChild(childContainer);
  }
};

describe("container scrollbar", () => {
  it("renders vertical scrollbar chrome when configured and overflowing", () => {
    const container = new Container();
    container.label = "inventory";
    const element = createScrollableElement();
    seedContainerChildren({ container, element });

    setupScrolling({
      container,
      element,
    });

    const root = container.getChildByLabel("inventory-scrollbar-vertical");
    const track = container.getChildByLabel(
      "inventory-scrollbar-vertical-track",
      true,
    );
    const thumb = container.getChildByLabel(
      "inventory-scrollbar-vertical-thumb",
      true,
    );
    const startButton = container.getChildByLabel(
      "inventory-scrollbar-vertical-start-button",
      true,
    );
    const endButton = container.getChildByLabel(
      "inventory-scrollbar-vertical-end-button",
      true,
    );

    expect(root).toBeTruthy();
    expect(root.x).toBe(84);
    expect(track.height).toBe(88);
    expect(thumb.height).toBeGreaterThan(0);
    expect(startButton.height).toBe(16);
    expect(endButton.height).toBe(16);
  });

  it("keeps the thumb in sync with wheel scrolling", () => {
    const container = new Container();
    container.label = "inventory";
    const element = createScrollableElement();
    seedContainerChildren({ container, element });

    setupScrolling({
      container,
      element,
    });

    const content = container.getChildByLabel("inventory-content");
    const thumb = container.getChildByLabel(
      "inventory-scrollbar-vertical-thumb",
      true,
    );
    const initialThumbY = thumb.y;

    container.emit("wheel", {
      deltaX: 0,
      deltaY: 40,
      shiftKey: false,
      preventDefault: vi.fn(),
    });

    expect(content.y).toBe(-40);
    expect(thumb.y).toBeGreaterThan(initialThumbY);
  });

  it("uses a fixed thumb length when configured", () => {
    const container = new Container();
    container.label = "inventory";
    const element = createScrollableElement();
    element.scrollbar.vertical.thumb.length = 32;
    seedContainerChildren({ container, element });

    setupScrolling({
      container,
      element,
    });

    const thumb = container.getChildByLabel(
      "inventory-scrollbar-vertical-thumb",
      true,
    );

    expect(thumb.height).toBe(32);
  });

  it("pages the content when clicking the track", () => {
    const container = new Container();
    container.label = "inventory";
    const element = createScrollableElement();
    seedContainerChildren({ container, element });

    setupScrolling({
      container,
      element,
    });

    const content = container.getChildByLabel("inventory-content");
    const track = container.getChildByLabel(
      "inventory-scrollbar-vertical-track",
      true,
    );

    track.emit("pointerdown", {
      global: { x: 90, y: 100 },
      stopPropagation: vi.fn(),
    });

    expect(content.y).toBe(-70);

    track.emit("pointerup", {
      stopPropagation: vi.fn(),
    });
  });

  it("scrolls by the configured step when clicking arrow buttons", () => {
    const container = new Container();
    container.label = "inventory";
    const element = createScrollableElement();
    seedContainerChildren({ container, element });

    setupScrolling({
      container,
      element,
    });

    const content = container.getChildByLabel("inventory-content");
    const endButton = container.getChildByLabel(
      "inventory-scrollbar-vertical-end-button",
      true,
    );
    const startButton = container.getChildByLabel(
      "inventory-scrollbar-vertical-start-button",
      true,
    );

    endButton.emit("pointerdown", {
      stopPropagation: vi.fn(),
    });

    expect(content.y).toBe(-24);

    endButton.emit("pointerup", {
      stopPropagation: vi.fn(),
    });

    startButton.emit("pointerdown", {
      stopPropagation: vi.fn(),
    });

    expect(content.y).toBe(0);
  });

  it("scrolls content when dragging the thumb", () => {
    const container = new Container();
    container.label = "inventory";
    const element = createScrollableElement();
    seedContainerChildren({ container, element });

    setupScrolling({
      container,
      element,
    });

    const root = container.getChildByLabel("inventory-scrollbar-vertical");
    const content = container.getChildByLabel("inventory-content");
    const thumb = container.getChildByLabel(
      "inventory-scrollbar-vertical-thumb",
      true,
    );

    thumb.emit("pointerdown", {
      global: { x: 90, y: 24 },
      stopPropagation: vi.fn(),
    });

    root.emit("globalpointermove", {
      global: { x: 90, y: 88 },
    });

    expect(content.y).toBeLessThan(0);

    root.emit("pointerup", {
      stopPropagation: vi.fn(),
    });
  });

  it("does not render the scrollbar when the content fits", () => {
    const container = new Container();
    container.label = "inventory";
    const element = {
      ...createScrollableElement(),
      children: [
        {
          id: "item-1",
          type: "rect",
          x: 0,
          y: 0,
          width: 80,
          height: 40,
        },
      ],
    };
    seedContainerChildren({ container, element });

    setupScrolling({
      container,
      element,
    });

    expect(
      container.getChildByLabel("inventory-scrollbar-vertical"),
    ).toBeNull();
  });
});
