import { describe, expect, it } from "vitest";

import { parseContainer } from "../../src/plugins/elements/container/parseContainer.js";
import { parseRect } from "../../src/plugins/elements/rect/parseRect.js";

const parserPlugins = [
  { type: "container", parse: parseContainer },
  { type: "rect", parse: parseRect },
];

const parse = (state) => parseContainer({ state, parserPlugins });

const rect = (id, width, height, overrides = {}) => ({
  id,
  type: "rect",
  width,
  height,
  fill: "#FFFFFF",
  ...overrides,
});

const container = (overrides = {}) => ({
  id: "box",
  type: "container",
  ...overrides,
});

const rtl = (overrides) =>
  parse(container({ ...overrides, readingDirection: "rtl" }));
const ltr = (overrides) => parse(container(overrides));

const boxes = (computed) =>
  computed.children.map(({ id, x, y, width, height }) => ({
    id,
    x,
    y,
    width,
    height,
  }));

// The layout a mirror held to the left-to-right layout shows: every child
// keeps its size and y, and its box is reflected in the container's width.
const mirrored = (computed) =>
  boxes(computed).map((box) => ({
    ...box,
    x: computed.width - box.x - box.width,
  }));

describe("parseContainer readingDirection", () => {
  describe("horizontal", () => {
    it("starts the row at the right edge and runs leftwards", () => {
      const computed = rtl({
        direction: "horizontal",
        gapX: 10,
        children: [rect("a", 100, 40), rect("b", 60, 40), rect("c", 30, 40)],
      });

      expect(computed.readingDirection).toBe("rtl");
      expect(computed.width).toBe(210);
      expect(computed.height).toBe(40);
      expect(boxes(computed)).toEqual([
        { id: "a", x: 110, y: 0, width: 100, height: 40 },
        { id: "b", x: 40, y: 0, width: 60, height: 40 },
        { id: "c", x: 0, y: 0, width: 30, height: 40 },
      ]);
    });

    it("keeps the free space of a wider container on the left", () => {
      const computed = rtl({
        direction: "horizontal",
        width: 500,
        gapX: 10,
        children: [rect("a", 100, 40), rect("b", 60, 40)],
      });

      expect(computed.width).toBe(500);
      expect(boxes(computed)).toEqual([
        { id: "a", x: 400, y: 0, width: 100, height: 40 },
        { id: "b", x: 330, y: 0, width: 60, height: 40 },
      ]);
    });

    it("starts every wrapped row at the right and ends a short row on the left", () => {
      const computed = rtl({
        direction: "horizontal",
        width: 250,
        gapX: 10,
        gapY: 20,
        children: [
          rect("a", 100, 40),
          rect("b", 100, 40),
          rect("c", 100, 40),
          rect("d", 100, 40),
          rect("e", 100, 40),
        ],
      });

      expect(boxes(computed)).toEqual([
        { id: "a", x: 150, y: 0, width: 100, height: 40 },
        { id: "b", x: 40, y: 0, width: 100, height: 40 },
        { id: "c", x: 150, y: 60, width: 100, height: 40 },
        { id: "d", x: 40, y: 60, width: 100, height: 40 },
        { id: "e", x: 150, y: 120, width: 100, height: 40 },
      ]);
    });

    it("lets content wider than the container reach past its left edge", () => {
      const computed = rtl({
        direction: "horizontal",
        width: 150,
        scroll: true,
        gapX: 10,
        children: [rect("a", 100, 40), rect("b", 100, 40), rect("c", 100, 40)],
      });

      expect(boxes(computed).map(({ id, x }) => ({ id, x }))).toEqual([
        { id: "a", x: 50 },
        { id: "b", x: -60 },
        { id: "c", x: -170 },
      ]);
    });
  });

  describe("vertical", () => {
    it("lines narrower children up on the right edge", () => {
      const computed = rtl({
        direction: "vertical",
        gapY: 10,
        children: [rect("a", 200, 40), rect("b", 120, 40), rect("c", 60, 40)],
      });

      expect(computed.readingDirection).toBe("rtl");
      expect(computed.width).toBe(200);
      expect(boxes(computed)).toEqual([
        { id: "a", x: 0, y: 0, width: 200, height: 40 },
        { id: "b", x: 80, y: 50, width: 120, height: 40 },
        { id: "c", x: 140, y: 100, width: 60, height: 40 },
      ]);
    });

    it("lines children up on the right edge of a wider container", () => {
      const computed = rtl({
        direction: "vertical",
        width: 300,
        children: [rect("a", 200, 40), rect("b", 120, 40)],
      });

      expect(boxes(computed).map(({ id, x }) => ({ id, x }))).toEqual([
        { id: "a", x: 100 },
        { id: "b", x: 180 },
      ]);
    });

    it("adds wrapped columns to the left", () => {
      const computed = rtl({
        direction: "vertical",
        height: 100,
        gapX: 20,
        gapY: 10,
        children: [
          rect("a", 100, 40),
          rect("b", 80, 40),
          rect("c", 100, 40),
          rect("d", 100, 40),
          rect("e", 50, 40),
        ],
      });

      // Three columns of 100, 100 and 50px with two 20px gaps.
      expect(computed.width).toBe(290);
      expect(boxes(computed)).toEqual([
        { id: "a", x: 190, y: 0, width: 100, height: 40 },
        { id: "b", x: 210, y: 50, width: 80, height: 40 },
        { id: "c", x: 70, y: 0, width: 100, height: 40 },
        { id: "d", x: 70, y: 50, width: 100, height: 40 },
        { id: "e", x: 0, y: 0, width: 50, height: 40 },
      ]);
    });
  });

  describe("mirror image of the left-to-right layout", () => {
    const layouts = {
      "a horizontal row": {
        direction: "horizontal",
        gapX: 7,
        children: [rect("a", 91, 40), rect("b", 33, 20), rect("c", 58, 60)],
      },
      "a wrapping grid": {
        direction: "horizontal",
        width: 333,
        gapX: 9,
        gapY: 5,
        children: [
          rect("a", 120, 40),
          rect("b", 150, 70),
          rect("c", 90, 30),
          rect("d", 200, 30),
          rect("e", 45, 30),
        ],
      },
      "a column": {
        direction: "vertical",
        gapY: 3,
        children: [rect("a", 91, 40), rect("b", 33, 20), rect("c", 58, 60)],
      },
      "wrapping columns": {
        direction: "vertical",
        width: 500,
        height: 130,
        gapX: 11,
        gapY: 5,
        children: [
          rect("a", 120, 40),
          rect("b", 150, 70),
          rect("c", 90, 30),
          rect("d", 200, 30),
        ],
      },
      "children with anchors and scales": {
        direction: "horizontal",
        gapX: 10,
        children: [
          rect("a", 100, 40, { anchorX: 0.5 }),
          rect("b", 60, 40, { scaleX: 1.5 }),
          rect("c", 30, 40, { anchorX: 1 }),
        ],
      },
      "a scaled container": {
        direction: "horizontal",
        width: 200,
        scaleX: 1.5,
        scaleY: 2,
        gapX: 10,
        children: [rect("a", 100, 40), rect("b", 60, 40), rect("c", 90, 40)],
      },
    };

    it.each(Object.entries(layouts))("mirrors %s", (_name, layout) => {
      const leftToRight = ltr(layout);
      const rightToLeft = rtl(layout);

      expect(boxes(rightToLeft)).toEqual(mirrored(leftToRight));
      expect(rightToLeft.width).toBe(leftToRight.width);
      expect(rightToLeft.height).toBe(leftToRight.height);
      expect(rightToLeft.x).toBe(leftToRight.x);
      expect(rightToLeft.y).toBe(leftToRight.y);
    });
  });

  it("moves children without changing anything else about them", () => {
    const layout = {
      direction: "horizontal",
      gapX: 10,
      children: [
        rect("a", 100, 40, { anchorX: 0.5, rotation: 30 }),
        container({
          id: "inner",
          direction: "vertical",
          children: [rect("inner-a", 80, 20), rect("inner-b", 40, 20)],
        }),
      ],
    };
    const withoutX = (computed) =>
      computed.children.map(({ x: _x, ...rest }) => rest);

    expect(withoutX(rtl(layout))).toEqual(withoutX(ltr(layout)));
  });

  it("applies to each container on its own", () => {
    const computed = ltr({
      direction: "horizontal",
      gapX: 10,
      children: [
        rect("a", 50, 40),
        container({
          id: "inner",
          direction: "horizontal",
          readingDirection: "rtl",
          gapX: 10,
          children: [rect("inner-a", 80, 20), rect("inner-b", 40, 20)],
        }),
      ],
    });

    expect(computed.readingDirection).toBeUndefined();
    expect(boxes(computed).map(({ id, x }) => ({ id, x }))).toEqual([
      { id: "a", x: 0 },
      { id: "inner", x: 60 },
    ]);
    expect(computed.children[1].readingDirection).toBe("rtl");
    expect(boxes(computed.children[1]).map(({ id, x }) => ({ id, x }))).toEqual(
      [
        { id: "inner-a", x: 50 },
        { id: "inner-b", x: 0 },
      ],
    );
  });

  it("places a collapsed child container at the mirrored point", () => {
    const layout = {
      direction: "horizontal",
      gapX: 10,
      children: [
        rect("a", 100, 40),
        container({
          id: "collapsed",
          scaleX: 0,
          children: [rect("inner", 80, 20)],
        }),
        rect("b", 60, 40),
      ],
    };
    const leftToRight = ltr(layout);
    const rightToLeft = rtl(layout);
    const collapsedX = (computed) => computed.children[1].x;

    // The collapsed container takes no width: it sits at the point between
    // the two gaps, 110px from the start edge on either side.
    expect(leftToRight.width).toBe(180);
    expect(collapsedX(leftToRight)).toBe(110);
    expect(collapsedX(rightToLeft)).toBe(70);
    expect(rightToLeft.children[2].x).toBe(0);
  });

  it("is ignored by absolute containers", () => {
    const layout = {
      children: [rect("a", 100, 40, { x: 20 }), rect("b", 60, 40, { x: 200 })],
    };

    expect(rtl(layout)).toEqual(ltr(layout));
    expect(rtl({ ...layout, direction: "absolute" })).toEqual(
      ltr({ ...layout, direction: "absolute" }),
    );
    expect(rtl(layout).readingDirection).toBeUndefined();
  });

  it("treats ltr like no readingDirection", () => {
    const layout = {
      direction: "horizontal",
      gapX: 10,
      children: [rect("a", 100, 40), rect("b", 60, 40)],
    };

    expect(ltr({ ...layout, readingDirection: "ltr" })).toEqual(ltr(layout));
    expect(ltr(layout).readingDirection).toBeUndefined();
  });

  it("rejects unknown values", () => {
    expect(() =>
      ltr({
        direction: "horizontal",
        readingDirection: "right",
        children: [rect("a", 100, 40)],
      }),
    ).toThrow("Input Error: readingDirection must be one of ltr, rtl.");
  });
});
