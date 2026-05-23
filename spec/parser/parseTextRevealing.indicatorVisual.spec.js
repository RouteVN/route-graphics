import { describe, expect, it } from "vitest";

import { parseTextRevealing } from "../../src/plugins/elements/text-revealing/parseTextRevealing.js";

const createState = (indicator) => ({
  id: "indicator-line",
  type: "text-revealing",
  x: 0,
  y: 0,
  content: [{ text: "Animated indicator" }],
  indicator,
});

const atlas = {
  frames: {
    "idle-0": {
      x: 0,
      y: 0,
      width: 8,
      height: 8,
    },
    "idle-1": {
      x: 8,
      y: 0,
      width: 8,
      height: 8,
    },
  },
};

describe("parseTextRevealing indicator visuals", () => {
  it("normalizes spritesheet indicator visuals with clips and playback", () => {
    const parsed = parseTextRevealing({
      state: createState({
        revealing: {
          kind: "spritesheet",
          src: "cursor-sheet",
          width: 18,
          height: 18,
          atlas,
          clips: {
            blink: ["idle-0", "idle-1"],
          },
          playback: {
            clip: "blink",
            fps: 12,
            loop: true,
            autoplay: false,
          },
        },
        complete: {
          kind: "image",
          src: "cursor-complete",
        },
      }),
    });

    expect(parsed.indicator.revealing).toEqual({
      kind: "spritesheet",
      src: "cursor-sheet",
      width: 18,
      height: 18,
      atlas: {
        frames: {
          "idle-0": {
            frame: { x: 0, y: 0, w: 8, h: 8 },
            rotated: false,
            trimmed: false,
            spriteSourceSize: { x: 0, y: 0, w: 8, h: 8 },
            sourceSize: { w: 8, h: 8 },
          },
          "idle-1": {
            frame: { x: 8, y: 0, w: 8, h: 8 },
            rotated: false,
            trimmed: false,
            spriteSourceSize: { x: 0, y: 0, w: 8, h: 8 },
            sourceSize: { w: 8, h: 8 },
          },
        },
        meta: {
          scale: "1",
        },
      },
      clips: {
        blink: ["idle-0", "idle-1"],
      },
      playback: {
        clip: "blink",
        frames: ["idle-0", "idle-1"],
        fps: 12,
        loop: true,
        autoplay: false,
      },
    });
    expect(parsed.indicator.complete).toEqual({
      kind: "image",
      src: "cursor-complete",
      width: 12,
      height: 12,
    });
  });

  it("infers spritesheet kind when atlas or playback fields are present", () => {
    const parsed = parseTextRevealing({
      state: createState({
        revealing: {
          src: "cursor-sheet",
          atlas,
          playback: {
            frames: ["idle-1"],
          },
        },
      }),
    });

    expect(parsed.indicator.revealing.kind).toBe("spritesheet");
    expect(parsed.indicator.revealing.playback.frames).toEqual(["idle-1"]);
  });

  it("rejects unsupported indicator visual kinds", () => {
    expect(() =>
      parseTextRevealing({
        state: createState({
          revealing: {
            kind: "video",
            src: "cursor-video",
          },
        }),
      }),
    ).toThrow("indicator.revealing.kind must be one of image, spritesheet");
  });
});
