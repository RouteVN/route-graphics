import { describe, expect, it } from "vitest";

import { parseTextRevealing } from "../../src/plugins/elements/text-revealing/parseTextRevealing.js";

const createState = (overrides = {}) => ({
  id: "line-1",
  type: "text-revealing",
  x: 0,
  y: 0,
  content: [{ text: "Reveal sound parser coverage." }],
  textStyle: {
    fontFamily: "Arial",
    fontSize: 20,
    breakWords: false,
  },
  ...overrides,
});

describe("parseTextRevealing revealSound", () => {
  it("accepts object config and defaults to full-volume looping playback", () => {
    const parsed = parseTextRevealing({
      state: createState({
        revealSound: {
          src: "voice-blip",
        },
      }),
    });

    expect(parsed.revealSound).toEqual({
      src: "voice-blip",
      volume: 100,
      loop: true,
      stopTiming: "loopEnd",
    });
  });

  it("preserves object volume, loop, and stop timing overrides", () => {
    const parsed = parseTextRevealing({
      state: createState({
        revealSound: {
          src: "voice-blip",
          volume: 45,
          loop: false,
          stopTiming: "immediate",
        },
      }),
    });

    expect(parsed.revealSound).toEqual({
      src: "voice-blip",
      volume: 45,
      loop: false,
      stopTiming: "immediate",
    });
  });

  it("rejects invalid reveal sound configuration", () => {
    expect(() =>
      parseTextRevealing({
        state: createState({
          revealSound: "voice-blip",
        }),
      }),
    ).toThrow("Input Error: revealSound must be an object.");

    expect(() =>
      parseTextRevealing({
        state: createState({
          revealSound: {
            src: "voice-blip",
            volume: 120,
          },
        }),
      }),
    ).toThrow(
      "Input Error: revealSound.volume must be a finite number between 0 and 100.",
    );

    expect(() =>
      parseTextRevealing({
        state: createState({
          revealSound: {
            src: "voice-blip",
            loop: "yes",
          },
        }),
      }),
    ).toThrow("Input Error: revealSound.loop must be a boolean.");

    expect(() =>
      parseTextRevealing({
        state: createState({
          revealSound: {
            src: "voice-blip",
            stopTiming: "later",
          },
        }),
      }),
    ).toThrow(
      "Input Error: revealSound.stopTiming must be one of loopEnd, immediate.",
    );
  });
});
