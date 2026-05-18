import { describe, expect, it } from "vitest";
import { parseTextRevealing } from "../../src/plugins/elements/text-revealing/parseTextRevealing.js";

describe("parseTextRevealing text shadow", () => {
  it("keeps shadow offsets out of segmented text advances", () => {
    const withoutShadow = parseTextRevealing({
      state: {
        id: "plain-dialogue",
        type: "text-revealing",
        x: 0,
        y: 0,
        width: 480,
        textStyle: {
          fontSize: 24,
          fontFamily: "Arial",
        },
        content: [{ text: "A" }, { text: "B" }],
      },
    });
    const withShadow = parseTextRevealing({
      state: {
        id: "shadowed-dialogue",
        type: "text-revealing",
        x: 0,
        y: 0,
        width: 480,
        textStyle: {
          fontSize: 24,
          fontFamily: "Arial",
          shadow: {
            offsetX: 10,
            offsetY: 0,
          },
        },
        content: [{ text: "A" }, { text: "B" }],
      },
    });

    expect(withShadow.content[0].lineParts[1].x).toBe(
      withoutShadow.content[0].lineParts[1].x,
    );
  });

  it("inherits, deep-merges, and removes shadow across segment styles", () => {
    const parsed = parseTextRevealing({
      state: {
        id: "shadowed-dialogue",
        type: "text-revealing",
        x: 0,
        y: 0,
        width: 480,
        textStyle: {
          fontSize: 24,
          fontFamily: "Arial",
          fill: "#FFFFFF",
          shadow: {
            color: "#111111",
            alpha: 0.4,
            blur: 3,
            offsetX: 2,
            offsetY: 4,
          },
        },
        content: [
          {
            text: "Base shadow. ",
          },
          {
            text: "Merged shadow.",
            textStyle: {
              fill: "#D9D9D9",
              shadow: {
                color: "#333333",
                alpha: 0.9,
              },
            },
          },
          {
            text: " Ruby",
            furigana: {
              text: "ru",
              textStyle: {
                fontSize: 12,
                shadow: null,
              },
            },
          },
        ],
      },
    });

    const [basePart, mergedPart, rubyPart] = parsed.content[0].lineParts;

    expect(basePart.textStyle.shadow).toEqual({
      color: "#111111",
      alpha: 0.4,
      blur: 3,
      offsetX: 2,
      offsetY: 4,
    });
    expect(mergedPart.textStyle.shadow).toEqual({
      color: "#333333",
      alpha: 0.9,
      blur: 3,
      offsetX: 2,
      offsetY: 4,
    });
    expect(rubyPart.furigana.textStyle.shadow).toBeNull();
  });
});
