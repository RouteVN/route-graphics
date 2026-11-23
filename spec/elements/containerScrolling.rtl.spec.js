import { Container } from "pixi.js";
import { describe, expect, it } from "vitest";

import { parseContainer } from "../../src/plugins/elements/container/parseContainer.js";
import { parseRect } from "../../src/plugins/elements/rect/parseRect.js";
import {
  getScrollingState,
  setupScrolling,
} from "../../src/plugins/elements/container/util/scrollingUtils.js";

const parserPlugins = [
  { type: "container", parse: parseContainer },
  { type: "rect", parse: parseRect },
];

const rect = (id, width, height) => ({
  id,
  type: "rect",
  width,
  height,
  fill: "#FFFFFF",
});

// Three 100px items with 10px gaps in a 150px viewport: 320px of content,
// 170px more than fits.
const parseRow = (overrides = {}) =>
  parseContainer({
    state: {
      id: "row",
      type: "container",
      direction: "horizontal",
      readingDirection: "rtl",
      width: 150,
      height: 40,
      gapX: 10,
      scroll: true,
      children: [rect("a", 100, 40), rect("b", 100, 40), rect("c", 100, 40)],
      ...overrides,
    },
    parserPlugins,
  });

const mount = (element, options = {}) => {
  const container = new Container();
  container.label = element.id;
  for (const child of element.children) {
    const childContainer = new Container();
    childContainer.label = child.id;
    container.addChild(childContainer);
  }

  setupScrolling({ container, element, ...options });

  return {
    container,
    content: container.getChildByLabel(`${element.id}-content`),
  };
};

const wheel = (container, deltaX) =>
  container.emit("wheel", { deltaX, deltaY: 0, shiftKey: false });

describe("scrolling a right-to-left container", () => {
  it("starts a horizontal row at its right end", () => {
    const element = parseRow();
    const { container, content } = mount(element);

    // The first child's right edge is the viewport's right edge.
    expect(element.children[0].x + element.children[0].width).toBe(150);
    expect(content.x).toBe(0);
    expect(getScrollingState({ container })).toMatchObject({
      scrollXOffset: 0,
      wasAtHorizontalEnd: false,
    });
  });

  it("scrolls leftwards to the end and stops at both ends", () => {
    const { container, content } = mount(parseRow());

    // Wheeling right at the start has nowhere to go.
    wheel(container, 40);
    expect(content.x).toBe(0);

    // Wheeling left brings the content in from the left.
    wheel(container, -40);
    expect(content.x).toBe(40);

    wheel(container, -500);
    expect(content.x).toBe(170);
    expect(getScrollingState({ container }).wasAtHorizontalEnd).toBe(true);

    wheel(container, 500);
    expect(content.x).toBe(0);
  });

  it("shows the left end with anchorToBottom", () => {
    const { content } = mount(parseRow({ anchorToBottom: true }));

    expect(content.x).toBe(170);
  });

  it("keeps anchorToBottom at the end when content is added", () => {
    const { container } = mount(parseRow({ anchorToBottom: true }));
    const previousState = getScrollingState({ container });
    const longer = parseRow({
      anchorToBottom: true,
      children: [
        rect("a", 100, 40),
        rect("b", 100, 40),
        rect("c", 100, 40),
        rect("d", 100, 40),
      ],
    });

    expect(previousState.wasAtHorizontalEnd).toBe(true);
    expect(mount(longer, { previousState }).content.x).toBe(280);
  });

  it("keeps the scroll position across an update", () => {
    const { container } = mount(parseRow());
    wheel(container, -60);
    const previousState = getScrollingState({ container });

    expect(mount(parseRow(), { previousState }).content.x).toBe(60);
    // A position past the new content is brought back to its end.
    expect(
      mount(parseRow({ children: [rect("a", 100, 40), rect("b", 100, 40)] }), {
        previousState: { scrollXOffset: 500 },
      }).content.x,
    ).toBe(60);
  });

  it("does not scroll horizontally when the row fits", () => {
    const element = parseRow({ width: 400 });
    const { container } = mount(element);

    expect(container.getChildByLabel("row-content")).toBeNull();
  });

  it("puts the vertical scrollbar on the left", () => {
    const column = (readingDirection) =>
      parseContainer({
        state: {
          id: "list",
          type: "container",
          direction: "vertical",
          readingDirection,
          width: 100,
          height: 120,
          gapY: 5,
          scroll: true,
          scrollbar: {
            vertical: {
              thickness: 16,
              track: { src: "scroll-track" },
              thumb: { src: "scroll-thumb" },
            },
          },
          children: [rect("a", 80, 60), rect("b", 80, 60), rect("c", 80, 60)],
        },
        parserPlugins,
      });
    const scrollbarX = (element) =>
      mount(element).container.getChildByLabel("list-scrollbar-vertical").x;

    expect(scrollbarX(column("rtl"))).toBe(0);
    expect(scrollbarX(column("ltr"))).toBe(84);
  });

  it("leaves a left-to-right row scrolling rightwards from its left end", () => {
    const { container, content } = mount(parseRow({ readingDirection: "ltr" }));

    expect(content.x).toBe(0);
    wheel(container, -40);
    expect(content.x).toBe(0);
    wheel(container, 40);
    expect(content.x).toBe(-40);
    wheel(container, 500);
    expect(content.x).toBe(-170);
    expect(getScrollingState({ container }).wasAtHorizontalEnd).toBe(true);
  });
});
