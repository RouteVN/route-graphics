import { describe, expect, it } from "vitest";
import { hitTestElementBounds } from "../../src/util/hitTestElementBounds.js";

const createDisplayObject = ({
  label,
  zIndex = 0,
  matrix = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
  localBounds,
  children = [],
  visible = true,
} = {}) => {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  const displayObject = {
    label,
    zIndex,
    children,
    visible,
    toGlobal: ({ x, y }) => ({
      x: matrix.a * x + matrix.c * y + matrix.tx,
      y: matrix.b * x + matrix.d * y + matrix.ty,
    }),
    toLocal: ({ x, y }) => {
      const translatedX = x - matrix.tx;
      const translatedY = y - matrix.ty;

      return {
        x: (matrix.d * translatedX - matrix.c * translatedY) / determinant,
        y: (-matrix.b * translatedX + matrix.a * translatedY) / determinant,
      };
    },
  };

  if (localBounds) {
    displayObject.getLocalBounds = () => localBounds;
  }

  for (const child of children) {
    child.parent = displayObject;
  }

  return displayObject;
};

const createElement = ({
  id,
  type = "rect",
  width = 100,
  height = 100,
  children,
  ...rest
}) => ({ id, type, width, height, children, ...rest });

describe("hitTestElementBounds", () => {
  it("returns overlapping semantic branches in actual front-to-back order", () => {
    const backDisplay = createDisplayObject({ label: "back", zIndex: 0 });
    const childDisplay = createDisplayObject({
      label: "child",
      zIndex: 0,
      matrix: { a: 1, b: 0, c: 0, d: 1, tx: 20, ty: 10 },
    });
    const frontDisplay = createDisplayObject({
      label: "front",
      zIndex: 1,
      children: [childDisplay],
    });
    const stage = createDisplayObject({
      children: [backDisplay, frontDisplay],
    });

    const hits = hitTestElementBounds({
      stage,
      elements: [
        createElement({ id: "back" }),
        createElement({
          id: "front",
          type: "container",
          children: [createElement({ id: "child", width: 20, height: 20 })],
        }),
      ],
      x: 25,
      y: 15,
    });

    expect(hits.map(({ path }) => path.map(({ id }) => id))).toEqual([
      ["front", "child"],
      ["back"],
    ]);
  });

  it("uses live rotated geometry and returns its transformed quadrilateral", () => {
    const display = createDisplayObject({
      label: "rotated",
      matrix: { a: 0, b: 1, c: -1, d: 0, tx: 100, ty: 0 },
    });
    const stage = createDisplayObject({ children: [display] });

    const [hit] = hitTestElementBounds({
      stage,
      elements: [
        createElement({ id: "rotated", width: 20, height: 10, alpha: 0 }),
      ],
      x: 95,
      y: 10,
    });

    expect(hit.path[0].bounds).toEqual({
      x: 90,
      y: 0,
      width: 10,
      height: 20,
      corners: [
        { x: 100, y: 0 },
        { x: 100, y: 20 },
        { x: 90, y: 20 },
        { x: 90, y: 0 },
      ],
    });
  });

  it("honors a scrolling container's live offset and viewport clip", () => {
    const visibleChild = createDisplayObject({
      label: "visible-child",
      matrix: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: -40 },
    });
    const clippedChild = createDisplayObject({
      label: "clipped-child",
      matrix: { a: 1, b: 0, c: 0, d: 1, tx: 60, ty: 0 },
    });
    const content = createDisplayObject({
      label: "viewport-content",
      children: [visibleChild, clippedChild],
    });
    const viewport = createDisplayObject({ label: "viewport" });
    viewport.__routeGraphicsScrollController = {
      contentContainer: content,
      viewportWidth: 50,
      viewportHeight: 50,
    };
    const back = createDisplayObject({ label: "back", zIndex: -1 });
    const stage = createDisplayObject({ children: [back, viewport] });
    const elements = [
      createElement({ id: "back", width: 200, height: 200 }),
      createElement({
        id: "viewport",
        type: "container",
        width: 50,
        height: 50,
        children: [
          createElement({ id: "visible-child", width: 20, height: 80 }),
          createElement({ id: "clipped-child", width: 20, height: 20 }),
        ],
      }),
    ];

    const visibleHits = hitTestElementBounds({
      stage,
      elements,
      x: 10,
      y: 5,
    });
    const clippedHits = hitTestElementBounds({
      stage,
      elements,
      x: 65,
      y: 5,
    });

    expect(visibleHits[0].path.map(({ id }) => id)).toEqual([
      "viewport",
      "visible-child",
    ]);
    expect(visibleHits[0].path.at(-1).bounds.y).toBe(-40);
    expect(clippedHits[0].path.map(({ id }) => id)).toEqual(["back"]);
  });

  it("uses sprite-local bounds and excludes design-interaction chrome", () => {
    const sprite = createDisplayObject({
      label: "sprite",
      zIndex: 1,
      matrix: { a: 10, b: 0, c: 0, d: 10, tx: 0, ty: 0 },
      localBounds: { x: 0, y: 0, width: 10, height: 5 },
    });
    const chrome = createDisplayObject({ label: "chrome", zIndex: 2 });
    const stage = createDisplayObject({ children: [sprite, chrome] });

    const hits = hitTestElementBounds({
      stage,
      elements: [
        createElement({
          id: "sprite",
          type: "sprite",
          width: 100,
          height: 50,
        }),
        createElement({ id: "chrome", designInteraction: true }),
      ],
      x: 90,
      y: 40,
    });

    expect(hits).toHaveLength(1);
    expect(hits[0].path[0]).toMatchObject({
      id: "sprite",
      bounds: { x: 0, y: 0, width: 100, height: 50 },
    });
  });

  it("includes fixed-width text whitespace before centered glyphs", () => {
    const text = createDisplayObject({
      label: "centered-text",
      matrix: { a: 1, b: 0, c: 0, d: 1, tx: 40, ty: 0 },
    });
    const stage = createDisplayObject({ children: [text] });

    const [hit] = hitTestElementBounds({
      stage,
      elements: [
        createElement({
          id: "centered-text",
          type: "text",
          width: 100,
          height: 20,
          content: "Text",
          measuredWidth: 20,
          __fixedWidth: true,
          textStyle: { align: "center" },
        }),
      ],
      x: 5,
      y: 10,
    });

    expect(hit.path[0].bounds).toMatchObject({
      x: 0,
      y: 0,
      width: 100,
      height: 20,
    });
  });

  it("keeps a zero-size container on the path when its child is hit", () => {
    const child = createDisplayObject({ label: "child" });
    const container = createDisplayObject({
      label: "container",
      children: [child],
    });
    const stage = createDisplayObject({ children: [container] });

    const [hit] = hitTestElementBounds({
      stage,
      elements: [
        createElement({
          id: "container",
          type: "container",
          width: 0,
          height: 0,
          children: [createElement({ id: "child", width: 20, height: 20 })],
        }),
      ],
      x: 10,
      y: 10,
    });

    expect(hit.path.map(({ id }) => id)).toEqual(["container", "child"]);
  });
});
