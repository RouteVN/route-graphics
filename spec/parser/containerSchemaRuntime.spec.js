import { describe, expect, it } from "vitest";

import { parseContainer } from "../../src/plugins/elements/container/parseContainer.js";
import { parseRect } from "../../src/plugins/elements/rect/parseRect.js";
import { parseTextRevealing } from "../../src/plugins/elements/text-revealing/parseTextRevealing.js";

// Real parsers wired the way parseElements resolves them, so every container
// under test parses its children through the production parsers.
const parserPlugins = [
  { type: "container", parse: parseContainer },
  { type: "text-revealing", parse: parseTextRevealing },
  { type: "rect", parse: parseRect },
];

const parse = (state) => parseContainer({ state, parserPlugins });

const revealingText = (id, overrides = {}) => ({
  id,
  type: "text-revealing",
  x: 0,
  y: 0,
  width: 360,
  content: [{ text: "Hello, container." }],
  textStyle: { fontFamily: "Arial", fontSize: 28, fill: "#FFFFFF" },
  revealEffect: "none",
  ...overrides,
});

const choice = (id, text) =>
  revealingText(id, {
    width: 160,
    content: [{ text }],
    textStyle: { fontFamily: "Arial", fontSize: 24, fill: "#FFFFFF" },
  });

// Join wrapped line parts back into one comparable string. Wrapping depends on
// the pinned test font, so content assertions must not assume line breaks.
const flattenedText = (computedTextRevealing) =>
  computedTextRevealing.content
    .flatMap((chunk) => chunk.lineParts.map((part) => part.text))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

const originalScene = () => ({
  id: "dialogue",
  type: "container",
  children: [
    revealingText("line", { x: 32, y: 32 }),
    {
      id: "choices",
      type: "container",
      x: 32,
      y: 112,
      direction: "horizontal",
      gapX: 24,
      children: [
        choice("first", "First choice"),
        choice("second", "Second choice"),
      ],
    },
  ],
});

const updatedScene = () => ({
  id: "dialogue",
  type: "container",
  x: 80,
  y: 64,
  direction: "vertical",
  gapY: 32,
  children: [
    revealingText("line", {
      x: 32,
      y: 32,
      content: [{ text: "Choose a new direction." }],
    }),
    {
      id: "choices",
      type: "container",
      direction: "vertical",
      gapY: 16,
      children: [
        choice("first", "First choice"),
        choice("second", "Second choice"),
      ],
    },
  ],
});

describe("parseContainer with omitted container coordinates", () => {
  it("defaults the container position to the origin", () => {
    const computed = parse({
      id: "dialogue",
      type: "container",
      children: [revealingText("line", { x: 32, y: 32 })],
    });

    expect(computed.x).toBe(0);
    expect(computed.y).toBe(0);
    expect(computed.originX).toBe(0);
    expect(computed.originY).toBe(0);
    expect(computed.direction).toBe("absolute");
  });

  it("defaults omitted coordinates on a nested container in an absolute parent", () => {
    const computed = parse({
      id: "outer",
      type: "container",
      children: [
        {
          id: "nested",
          type: "container",
          children: [revealingText("line", { x: 8, y: 12 })],
        },
      ],
    });

    const [nested] = computed.children;
    expect(nested.type).toBe("container");
    // The computed schema still requires resolved coordinates on every child.
    expect(nested.x).toBe(0);
    expect(nested.y).toBe(0);
    expect(Number.isFinite(nested.width)).toBe(true);
    expect(Number.isFinite(nested.height)).toBe(true);
    expect(nested.children[0].x).toBe(8);
    expect(nested.children[0].y).toBe(12);
  });
});

describe("parseContainer absolute layout with revealing text", () => {
  it("preserves explicit child coordinates and sizes the container around them", () => {
    const computed = parse({
      id: "dialogue",
      type: "container",
      children: [revealingText("line", { x: 32, y: 32 })],
    });

    const [line] = computed.children;
    expect(line.type).toBe("text-revealing");
    expect(line.x).toBe(32);
    expect(line.y).toBe(32);
    expect(line.width).toBe(360);
    expect(Number.isFinite(line.height)).toBe(true);
    expect(computed.width).toBe(32 + line.width);
    expect(computed.height).toBe(32 + line.height);
  });

  it("retains the revealing text content through container parsing", () => {
    const computed = parse(originalScene());

    const [line, choices] = computed.children;
    expect(flattenedText(line)).toBe("Hello, container.");
    expect(line.revealEffect).toBe("none");
    expect(line.textStyle.fill).toBe("#FFFFFF");
    expect(flattenedText(choices.children[0])).toBe("First choice");
    expect(flattenedText(choices.children[1])).toBe("Second choice");
  });
});

describe("parseContainer flow layouts with nested containers", () => {
  it("lays out a nested vertical container and its sibling in a horizontal parent", () => {
    const computed = parse({
      id: "outer",
      type: "container",
      direction: "horizontal",
      gapX: 10,
      children: [
        {
          id: "stack",
          type: "container",
          direction: "vertical",
          gapY: 4,
          children: [
            {
              id: "r1",
              type: "rect",
              x: 0,
              y: 0,
              width: 40,
              height: 20,
              fill: "#FF0000",
            },
            {
              id: "r2",
              type: "rect",
              x: 0,
              y: 0,
              width: 60,
              height: 10,
              fill: "#0000FF",
            },
          ],
        },
        {
          id: "c",
          type: "rect",
          x: 0,
          y: 0,
          width: 30,
          height: 30,
          fill: "#00FF00",
        },
      ],
    });

    const [stack, rectChild] = computed.children;
    // The nested stack omits x/y and receives its flow position from layout.
    expect(stack.x).toBe(0);
    expect(stack.y).toBe(0);
    expect(stack.width).toBe(60);
    expect(stack.height).toBe(34);
    expect(stack.children.map((child) => [child.x, child.y])).toEqual([
      [0, 0],
      [0, 24],
    ]);
    // Horizontal flow resumes after the whole nested container.
    expect(rectChild.x).toBe(stack.width + 10);
    expect(rectChild.y).toBe(0);
    expect(computed.width).toBe(rectChild.x + rectChild.width);
    expect(computed.height).toBe(stack.height);
  });

  it("overrides authored coordinates with flow positions in a vertical parent", () => {
    const computed = parse({
      id: "dialogue",
      type: "container",
      direction: "vertical",
      gapY: 16,
      children: [
        revealingText("line", { x: 32, y: 32 }),
        {
          id: "choices",
          type: "container",
          direction: "vertical",
          gapY: 8,
          children: [
            choice("first", "First choice"),
            choice("second", "Second"),
          ],
        },
      ],
    });

    const [line, choices] = computed.children;
    expect(line.x).toBe(0);
    expect(line.y).toBe(0);
    expect(choices.x).toBe(0);
    expect(choices.y).toBe(line.height + 16);
    expect(choices.children[0].x).toBe(0);
    expect(choices.children[0].y).toBe(0);
    expect(choices.children[1].y).toBe(choices.children[0].height + 8);
    expect(computed.width).toBe(Math.max(line.width, choices.width));
    expect(computed.height).toBe(choices.y + choices.height);
  });
});

describe("parseContainer re-parsing after an update", () => {
  it("restores the original layout when the original state is parsed again", () => {
    const beforeUpdate = parse(originalScene());
    const afterUpdate = parse(updatedScene());

    expect(afterUpdate.x).toBe(80);
    expect(afterUpdate.y).toBe(64);
    expect(afterUpdate.direction).toBe("vertical");
    expect(afterUpdate.children[0].x).toBe(0);
    expect(flattenedText(afterUpdate.children[0])).toBe(
      "Choose a new direction.",
    );
    expect(afterUpdate.children[1].direction).toBe("vertical");

    const restored = parse(originalScene());
    expect(restored).toEqual(beforeUpdate);
    expect(restored.x).toBe(0);
    expect(restored.y).toBe(0);
    expect(restored.direction).toBe("absolute");
    expect(restored.children[0].x).toBe(32);
    expect(restored.children[0].y).toBe(32);
    expect(flattenedText(restored.children[0])).toBe("Hello, container.");
    expect(restored.children[1].direction).toBe("horizontal");
    const [firstChoice, secondChoice] = restored.children[1].children;
    expect(secondChoice.x).toBe(firstChoice.width + 24);
    expect(secondChoice.y).toBe(0);
  });

  it("does not mutate the input state and parses it stably", () => {
    const original = originalScene();
    const snapshot = structuredClone(original);

    const computed = parse(original);

    // Computed children are copies of the authored nodes, never the same
    // objects, so layout coordinates cannot leak back into the input.
    expect(computed.children).not.toBe(original.children);
    expect(computed.children[0]).not.toBe(original.children[0]);
    expect(computed.children[1]).not.toBe(original.children[1]);
    expect(computed.children[1].children).not.toBe(
      original.children[1].children,
    );
    expect(original).toEqual(snapshot);

    // A second parse of the same input must agree with the first one; if the
    // first parse had mutated the input, this re-parse would drift.
    expect(parse(original)).toEqual(computed);
  });
});
