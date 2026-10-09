import { readFileSync } from "node:fs";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import { normalizeAnimatedSpritePlayback } from "../../src/plugins/elements/animated-sprite/animatedSpriteConfig.js";

const schema = yaml.load(
  readFileSync("src/schemas/elements/animated-sprite.element.yaml", "utf8"),
);

describe("spritesheet animation playback frame schema", () => {
  it("accepts numeric atlas frame indexes supported by playback", () => {
    const atlas = { frames: { idle: {}, run: {}, jump: {} } };
    const playback = normalizeAnimatedSpritePlayback({
      atlas,
      playback: { frames: [0, 2] },
    });

    expect(playback.frames).toEqual(["idle", "jump"]);
    expect(schema.properties.playback.properties.frames.items.type).toContain(
      "integer",
    );
  });

  it("continues to accept named frames", () => {
    expect(schema.properties.playback.properties.frames.items.type).toContain(
      "string",
    );
  });
});
