import { describe, expect, it } from "vitest";

import { parseTextRevealing } from "../../src/plugins/elements/text-revealing/parseTextRevealing.js";

const createState = (furigana = {}) => ({
  id: "furigana-placement",
  type: "text-revealing",
  width: 300,
  content: [
    {
      text: "BASE",
      textStyle: {
        fontFamily: "Arial",
        fontSize: 32,
      },
      furigana: {
        text: "ruby",
        textStyle: {
          fontFamily: "Arial",
          fontSize: 12,
        },
        ...furigana,
      },
    },
  ],
});

const firstPart = (parsed) => parsed.content[0].lineParts[0];

describe("parseTextRevealing furigana placement", () => {
  it("defaults to top placement with zero gap", () => {
    const legacy = firstPart(parseTextRevealing({ state: createState() }));
    const explicitTopNoGap = firstPart(
      parseTextRevealing({
        state: createState({
          placement: "top",
          gap: 0,
        }),
      }),
    );

    expect(legacy.furigana.x).toBe(explicitTopNoGap.furigana.x);
    expect(legacy.furigana.y).toBe(explicitTopNoGap.furigana.y);
  });

  it("moves top furigana farther from the base text with a positive gap", () => {
    const topNoGap = firstPart(
      parseTextRevealing({
        state: createState({
          placement: "top",
          gap: 0,
        }),
      }),
    );
    const topWithGap = firstPart(
      parseTextRevealing({
        state: createState({
          placement: "top",
          gap: 6,
        }),
      }),
    );

    expect(topWithGap.furigana.x).toBe(topNoGap.furigana.x);
    expect(topWithGap.furigana.y).toBe(topNoGap.furigana.y - 6);
    expect(topWithGap.furigana.y).toBeLessThan(topWithGap.y);
  });

  it("places bottom furigana below the base text with the configured gap", () => {
    const parsed = parseTextRevealing({
      state: createState({
        placement: "bottom",
        gap: 6,
      }),
    });
    const part = firstPart(parsed);

    expect(part.furigana.y).toBe(part.y + parsed.content[0].lineMaxHeight + 6);
    expect(part.furigana.y).toBeGreaterThan(part.y);
  });

  it("rejects unsupported placement values until that side is implemented", () => {
    expect(() =>
      parseTextRevealing({
        state: createState({
          placement: "left",
        }),
      }),
    ).toThrow(
      "Input Error: content[0].furigana.placement must be one of top, bottom.",
    );
  });

  it("rejects invalid gap values", () => {
    expect(() =>
      parseTextRevealing({
        state: createState({
          gap: -1,
        }),
      }),
    ).toThrow(
      "Input Error: content[0].furigana.gap must be a finite number >= 0.",
    );
  });
});
