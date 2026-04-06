import { describe, expect, it } from "vitest";

import { parseTextRevealing } from "../../src/plugins/elements/text-revealing/parseTextRevealing.js";

describe("parseTextRevealing wrap regressions", () => {
  it("wraps long content into multiple lines while preserving text order", () => {
    const sourceText =
      "This is a longer text that should wrap to multiple lines when it exceeds the specified width constraint for proper text layout demonstration.";
    const parsed = parseTextRevealing({
      state: {
        id: "tr2",
        type: "text-revealing",
        width: 300,
        content: [
          {
            text: sourceText,
          },
        ],
        textStyle: {
          fontSize: 20,
          fill: "#2c3e50",
          fontFamily: "Arial",
          breakWords: false,
        },
        x: 50,
        y: 50,
      },
    });

    expect(parsed.width).toBe(300);
    expect(parsed.x).toBe(50);
    expect(parsed.y).toBe(50);
    expect(parsed.content.length).toBeGreaterThan(1);
    expect(parsed.content.every((chunk) => chunk.lineParts.length === 1)).toBe(
      true,
    );
    expect(parsed.content.every((chunk) => chunk.lineParts[0].x === 0)).toBe(
      true,
    );
    expect(
      parsed.content.every(
        (chunk, index) => index === 0 || chunk.y > parsed.content[index - 1].y,
      ),
    ).toBe(true);

    const normalizedRenderedText = parsed.content
      .flatMap((chunk) => chunk.lineParts.map((part) => part.text))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    expect(normalizedRenderedText).toBe(
      sourceText.replace(/\s+/g, " ").trim(),
    );
  });

  it("starts each automatically wrapped line at x=0 for breakWords content", () => {
    const parsed = parseTextRevealing({
      state: {
        id: "_w75Q0xQpzx5My2hKEnLM",
        type: "text-revealing",
        width: 700,
        content: [
          {
            text: "This is a sample dialogue content. This is a sample dialogue content.This is a sample dialogue content.This is a sample dialogue content.This is a sample dialogue content.",
          },
        ],
        textStyle: {
          fontFamily: "Arial",
          fontSize: 24,
          fontWeight: "400",
          fontStyle: "normal",
          lineHeight: 1.2,
          fill: "#FFFFFF",
          align: "left",
          wordWrap: true,
          breakWords: true,
          wordWrapWidth: 300,
        },
      },
    });

    expect(parsed.content.length).toBeGreaterThan(1);
    expect(parsed.content.every((chunk) => chunk.lineParts.length === 1)).toBe(
      true,
    );
    expect(parsed.content.every((chunk) => chunk.lineParts[0].x === 0)).toBe(
      true,
    );
  });

  it("preserves explicit newline boundaries and indentation", () => {
    const parsed = parseTextRevealing({
      state: {
        id: "tr-explicit-newline",
        type: "text-revealing",
        width: 320,
        content: [
          {
            text: "First line\n  Second line",
          },
        ],
        textStyle: {
          fontSize: 22,
          fontFamily: "Arial",
          breakWords: false,
        },
      },
    });

    expect(parsed.content).toHaveLength(2);
    expect(parsed.content[0].lineParts[0].text).toBe("First line");
    expect(parsed.content[0].lineParts[0].x).toBe(0);
    expect(parsed.content[1].lineParts[0].text).toBe("  Second line");
    expect(parsed.content[1].lineParts[0].x).toBe(0);
    expect(parsed.content[1].y).toBeGreaterThan(parsed.content[0].y);
  });
});
