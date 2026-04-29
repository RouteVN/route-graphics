import { describe, expect, it } from "vitest";

import { parseTextRevealing } from "../../src/plugins/elements/text-revealing/parseTextRevealing.js";

const createState = (overrides = {}) => ({
  id: "line-1",
  type: "text-revealing",
  x: 0,
  y: 0,
  content: [{ text: "Already visible then revealed." }],
  textStyle: {
    fontFamily: "Arial",
    fontSize: 20,
    breakWords: false,
  },
  ...overrides,
});

describe("parseTextRevealing initialRevealedCharacters", () => {
  it("preserves a finite non-negative integer offset", () => {
    const parsed = parseTextRevealing({
      state: createState({
        initialRevealedCharacters: 8.9,
      }),
    });

    expect(parsed.initialRevealedCharacters).toBe(8);
  });

  it("normalizes unsafe supplied offsets to zero without adding the field when omitted", () => {
    const unsafe = parseTextRevealing({
      state: createState({
        initialRevealedCharacters: -4,
      }),
    });
    const omitted = parseTextRevealing({
      state: createState(),
    });

    expect(unsafe.initialRevealedCharacters).toBe(0);
    expect(omitted).not.toHaveProperty("initialRevealedCharacters");
  });
});
