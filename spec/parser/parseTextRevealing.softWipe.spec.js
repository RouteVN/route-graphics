import { describe, expect, it } from "vitest";

import { parseTextRevealing } from "../../src/plugins/elements/text-revealing/parseTextRevealing.js";

const createState = (overrides = {}) => ({
  id: "soft-wipe-line",
  type: "text-revealing",
  x: 0,
  y: 0,
  revealEffect: "softWipe",
  content: [{ text: "Soft wipe parameters" }],
  textStyle: {
    fontFamily: "Arial",
    fontSize: 20,
    breakWords: false,
  },
  ...overrides,
});

describe("parseTextRevealing softWipe", () => {
  it("normalizes supplied softWipe options with defaults", () => {
    const parsed = parseTextRevealing({
      state: createState({
        softWipe: {
          softness: 2,
          lineDelay: 120,
        },
      }),
    });

    expect(parsed.softWipe).toEqual({
      softness: 2,
      easing: "linear",
      lineOverlap: 0,
      lineDelay: 120,
    });
  });

  it("clamps unsafe numeric values and ignores unsupported options", () => {
    const parsed = parseTextRevealing({
      state: createState({
        softWipe: {
          direction: "rightToLeft",
          softness: -1,
          easing: "bounce",
          lineOverlap: 2,
          lineDelay: -20,
        },
      }),
    });

    expect(parsed.softWipe).toEqual({
      softness: 0,
      easing: "linear",
      lineOverlap: 0.95,
      lineDelay: 0,
    });
  });
});
