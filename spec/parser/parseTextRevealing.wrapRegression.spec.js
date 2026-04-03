import { describe, expect, it } from "vitest";

import { parseTextRevealing } from "../../src/plugins/elements/text-revealing/parseTextRevealing.js";

describe("parseTextRevealing wrap regressions", () => {
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
