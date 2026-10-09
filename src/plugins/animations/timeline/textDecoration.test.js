import { describe, expect, it, vi } from "vitest";
import {
  BlurFilter,
  CanvasTextMetrics,
  Container,
  Graphics,
  Text,
} from "pixi.js";
import { createAnimationBus } from "../animationBus.js";
import { dispatchUpdateAnimationsNow } from "../updateAnimationDispatch.js";
import { createCompletionTracker } from "../../../util/completionTracker.js";
import { normalizeAnimations } from "../../../util/normalizeAnimations.js";
import {
  applyTextDecoration,
  copyTextDecoration,
} from "../../../util/applyTextDecoration.js";
import { PIXI_TIMELINE_TEXT_UNITS } from "./pixiTimelineAdapters.js";
import { segmentPortableText } from "./textSegmentation.js";

const rectangles = (text) =>
  text.children.flatMap((child) =>
    child instanceof Graphics
      ? child.context.instructions.map(({ data }) => ({
          x: text.x + data.path.bounds.minX,
          y: text.y + data.path.bounds.minY,
          width: data.path.bounds.maxX - data.path.bounds.minX,
          height: data.path.bounds.maxY - data.path.bounds.minY,
        }))
      : [],
  );

const activate = ({
  content,
  unit,
  style = {},
  filters,
  values = { alpha: 1 },
}) => {
  const root = new Container({ label: "root" });
  const title = new Text({
    label: "title",
    text: content,
    style: { fontFamily: "Arial", fontSize: 24, fill: "#ff0000", ...style },
  });
  if (filters) title.filters = filters;
  applyTextDecoration(title, { textDecoration: "underline" });
  root.addChild(title);
  const original = rectangles(title);
  const bus = createAnimationBus();
  const tracker = createCompletionTracker();
  tracker.reset("underline");
  dispatchUpdateAnimationsNow({
    animations: normalizeAnimations([
      {
        id: "units",
        targetId: "root",
        type: "update",
        gsap: {
          profile: "portable-v1",
          targets: {
            units: {
              textUnits: {
                elementId: "title",
                unit,
                order: "logical",
                allowEmpty: true,
              },
            },
          },
          steps: [{ kind: "to", targets: "units", values, duration: 1000 }],
        },
      },
    ]),
    animationBus: bus,
    completionTracker: tracker,
    element: root,
    targetState: {},
  });
  bus.flush();
  return {
    root,
    title,
    original,
    bus,
    preparation: title[PIXI_TIMELINE_TEXT_UNITS],
    destroy: () => {
      bus.destroy();
      root.destroy({ children: true });
    },
  };
};

// Equality of total coverage catches both missing whitespace and overlapping
// spans (overlap would darken an underline during a partial-alpha animation).
const expectSameCoverage = (expected, actual) => {
  expect(actual.length).toBeGreaterThanOrEqual(expected.length);
  for (const line of expected) {
    const spans = actual
      .filter((rect) => Math.abs(rect.y - line.y) < 1e-8)
      .sort((a, b) => a.x - b.x);
    expect(spans.length).toBeGreaterThan(0);
    let cursor = line.x;
    for (const span of spans) {
      expect(span.x).toBeCloseTo(cursor, 8);
      expect(span.height).toBeCloseTo(line.height, 8);
      cursor += span.width;
    }
    expect(cursor).toBeCloseTo(line.x + line.width, 8);
  }
  expect(
    actual.every((span) =>
      expected.some((line) => Math.abs(span.y - line.y) < 1e-8),
    ),
  ).toBe(true);
};

describe("timeline underline coverage", () => {
  it.each([
    { content: "hello   world", unit: "word" },
    { content: "  hello world  ", unit: "word" },
    { content: "hello\n   \nworld", unit: "word" },
    { content: "   \nhello\nworld", unit: "word" },
    { content: "hello world\nhi", unit: "word", style: { align: "center" } },
    { content: "hello world\nhi", unit: "word", style: { align: "right" } },
    { content: "HELLO", unit: "grapheme", style: { letterSpacing: 6 } },
    { content: "HELLO", unit: "grapheme", style: { letterSpacing: -2 } },
    { content: "HELLO WORLD", unit: "grapheme", style: { letterSpacing: 6 } },
    {
      content: "hello world\nhi",
      unit: "line",
      style: { align: "center", lineHeight: 36 },
    },
  ])("preserves source underline geometry for $unit: $content", (options) => {
    const runtime = activate(options);
    try {
      const { preparation, title, original, bus } = runtime;
      expect(title.renderable).toBe(false);
      expect(preparation.targets).toHaveLength(
        segmentPortableText(options.content, options.unit).length,
      );
      expectSameCoverage(
        original,
        preparation.targets.flatMap(({ handle }) => rectangles(handle)),
      );
      bus.tick(500);
      expectSameCoverage(
        original,
        preparation.targets.flatMap(({ handle }) => rectangles(handle)),
      );
      expect(
        preparation.targets.every(({ handle }) => handle.alpha === 1),
      ).toBe(true);
    } finally {
      runtime.destroy();
    }
  });

  it("preserves an all-whitespace underline without creating word targets", () => {
    const runtime = activate({ content: "   ", unit: "word" });
    try {
      expect(runtime.preparation.targets).toHaveLength(0);
      expect(runtime.title.renderable).toBe(true);
      expect(rectangles(runtime.title)).toEqual(runtime.original);
    } finally {
      runtime.destroy();
    }
  });

  it("keeps filters on the visible source when whitespace creates no targets", () => {
    const filter = new BlurFilter({ strength: 2 });
    const replacementFilter = new BlurFilter({ strength: 4 });
    const runtime = activate({
      content: "   ",
      unit: "word",
      filters: [filter],
    });
    try {
      expect(runtime.title.renderable).toBe(true);
      expect(runtime.title.filters).toEqual([filter]);
      expect(runtime.preparation.container.filters ?? []).toHaveLength(0);
      runtime.preparation.sync();
      expect(runtime.title.filters).toEqual([filter]);
      runtime.title.filters = [replacementFilter];
      runtime.preparation.destroy();
      expect(runtime.title.filters).toEqual([replacementFilter]);
      expect(runtime.title.renderable).toBe(true);
    } finally {
      runtime.destroy();
      filter.destroy();
      replacementFilter.destroy();
    }
  });

  it("moves and fades each whitespace span with its owning word", () => {
    const runtime = activate({
      content: "hello world",
      unit: "word",
      values: { x: { by: 20 }, alpha: 0.5 },
    });
    try {
      const initial = runtime.preparation.targets.flatMap(({ handle }) =>
        rectangles(handle),
      );
      runtime.bus.tick(500);
      const moved = runtime.preparation.targets.flatMap(({ handle }) =>
        rectangles(handle),
      );
      expect(moved.map((rect, index) => rect.x - initial[index].x)).toEqual([
        10, 10,
      ]);
      expect(
        runtime.preparation.targets.map(({ handle }) => handle.alpha),
      ).toEqual([0.75, 0.75]);
      expect(moved.map(({ width }) => width)).toEqual(
        initial.map(({ width }) => width),
      );
    } finally {
      runtime.destroy();
    }
  });

  it("reuses source geometry across frame syncs instead of remeasuring each unit", () => {
    const runtime = activate({
      content: "HELLO WORLD",
      unit: "grapheme",
      style: { letterSpacing: 6 },
    });
    const measure = vi.spyOn(CanvasTextMetrics, "measureText");
    try {
      runtime.preparation.sync();
      runtime.preparation.sync();
      runtime.bus.tick(100);
      expect(measure).not.toHaveBeenCalled();
      runtime.title.style.fill = "#00ff00";
      runtime.preparation.sync();
      expect(measure).toHaveBeenCalledTimes(1);
      runtime.preparation.sync();
      expect(measure).toHaveBeenCalledTimes(1);
    } finally {
      measure.mockRestore();
      runtime.destroy();
    }
  });

  it("invalidates copied source geometry when text or font style changes", () => {
    const source = new Text({ text: "short", style: { fontSize: 24 } });
    const target = new Text({ text: "short", style: source.style });
    applyTextDecoration(source, { textDecoration: "underline" });
    const regions = [{ line: 0, start: -Infinity, end: Infinity, x: 0, y: 0 }];
    const measure = vi.spyOn(CanvasTextMetrics, "measureText");
    try {
      copyTextDecoration(target, source, regions);
      const originalWidth = rectangles(target)[0].width;
      copyTextDecoration(target, source, regions);
      expect(measure).not.toHaveBeenCalled();
      source.text = "much longer source";
      copyTextDecoration(target, source, regions);
      expect(measure).toHaveBeenCalledTimes(1);
      expect(rectangles(target)[0].width).toBeGreaterThan(originalWidth);
      const changedTextWidth = rectangles(target)[0].width;
      source.style.fontSize = 48;
      copyTextDecoration(target, source, regions);
      expect(measure).toHaveBeenCalledTimes(2);
      expect(rectangles(target)[0].width).toBeGreaterThan(changedTextWidth);
      copyTextDecoration(target, source, regions);
      expect(measure).toHaveBeenCalledTimes(2);
    } finally {
      measure.mockRestore();
      target.destroy({ children: true });
      source.destroy({ children: true });
    }
  });

  it("updates fill and removes retained unit decoration with the source style", () => {
    const runtime = activate({ content: "hello world", unit: "word" });
    try {
      runtime.title.style.fill = "#00ff00";
      runtime.preparation.sync();
      const decorations = runtime.preparation.targets.map(({ handle }) =>
        handle.children.find((child) => child instanceof Graphics),
      );
      expect(
        decorations.every(
          (decoration) =>
            decoration.context.instructions[0].data.style.color === 0x00ff00,
        ),
      ).toBe(true);
      applyTextDecoration(runtime.title, { textDecoration: "none" });
      runtime.preparation.sync();
      expect(decorations.every((decoration) => decoration.destroyed)).toBe(
        true,
      );
      expect(
        runtime.preparation.targets.every(
          ({ handle }) => handle.children.length === 0,
        ),
      ).toBe(true);
    } finally {
      runtime.destroy();
    }
  });
});
