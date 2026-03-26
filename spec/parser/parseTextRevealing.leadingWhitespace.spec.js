import { describe, expect, it } from "vitest";

import { parseTextRevealing } from "../../src/plugins/elements/text-revealing/parseTextRevealing.js";

describe("parseTextRevealing leading whitespace", () => {
  it("parses heavily indented content without hanging and preserves wrapped output", () => {
    const state = {
      id: "tr-indent",
      type: "text-revealing",
      width: 260,
      content: [
        {
          text: '        mu  rtd "I\'d argue against it, but that is how I did things when I went to town."',
        },
      ],
      textStyle: {
        fontSize: 22,
        fontFamily: "Arial",
        breakWords: false,
      },
    };

    const parsed = parseTextRevealing({ state });

    expect(parsed.type).toBe("text-revealing");
    expect(parsed.content.length).toBeGreaterThan(1);

    const lineTexts = parsed.content.flatMap((chunk) =>
      chunk.lineParts.map((part) => part.text),
    );
    const joined = lineTexts.join("");
    const normalized = joined.replace(/\s+/g, " ").trim();

    expect(joined.startsWith("        mu  rtd")).toBe(true);
    expect(normalized.includes("went to town")).toBe(true);
    expect(normalized.length).toBeGreaterThan(40);
    expect(lineTexts.every((text) => text.length > 0)).toBe(true);
  });

  it("can parse the same indented state repeatedly without diverging", () => {
    const state = {
      id: "tr-indent-repeat",
      type: "text-revealing",
      width: 260,
      content: [
        {
          text: 'v        murt "Taking things as they come, eh?"',
        },
      ],
      textStyle: {
        fontSize: 22,
        fontFamily: "Arial",
        breakWords: false,
      },
    };

    const outputs = Array.from({ length: 5 }, () =>
      parseTextRevealing({ state }),
    );

    expect(outputs.every((parsed) => parsed.content.length > 0)).toBe(true);
    expect(outputs.every((parsed) => parsed.height > 0)).toBe(true);
    expect(outputs.map((parsed) => parsed.height)).toEqual(
      Array(5).fill(outputs[0].height),
    );
  });
});
