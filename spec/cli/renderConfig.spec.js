import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  collectAssetDefinitions,
  loadRenderDefinition,
  parseBackgroundColor,
} from "../../src/cli/renderConfig.js";

describe("loadRenderDefinition", () => {
  it("normalizes a single wrapper document with config and states", () => {
    const definition = loadRenderDefinition(`
width: 1920
height: 1080
backgroundColor: "#112233"
assets:
  hero: ./hero.png
states:
  - id: intro
    elements:
      - id: title
        type: text
        content: Hello
`);

    expect(definition.width).toBe(1920);
    expect(definition.height).toBe(1080);
    expect(definition.backgroundColor).toBe("#112233");
    expect(definition.assets).toEqual({
      hero: "./hero.png",
    });
    expect(definition.states).toHaveLength(1);
    expect(definition.states[0]).toMatchObject({
      id: "intro",
      elements: [
        {
          id: "title",
          type: "text",
          content: "Hello",
        },
      ],
      animations: [],
      audio: [],
      global: {},
    });
  });

  it("treats multiple YAML documents as a state list", () => {
    const definition = loadRenderDefinition(`
id: first
elements: []
---
id: second
elements: []
`);

    expect(definition.states.map((state) => state.id)).toEqual([
      "first",
      "second",
    ]);
  });
});

describe("collectAssetDefinitions", () => {
  it("collects explicit aliases and direct file references", () => {
    const baseDir = path.resolve("/tmp/route-graphics");
    const states = [
      {
        id: "demo",
        elements: [
          {
            id: "sprite",
            type: "sprite",
            src: "./sprite.png",
            hover: {
              src: "hero",
              soundSrc: "./hover.mp3",
            },
          },
          {
            id: "movie",
            type: "video",
            src: "./intro.mp4",
          },
        ],
      },
    ];

    const definitions = collectAssetDefinitions({
      baseDir,
      states,
      assets: {
        hero: "./hero.png",
        uiFont: {
          path: "./fonts/ui.ttf",
          type: "font/ttf",
        },
      },
    });

    expect(definitions.hero).toMatchObject({
      kind: "local",
      path: path.join(baseDir, "hero.png"),
      type: "image/png",
    });
    expect(definitions.uiFont).toMatchObject({
      kind: "local",
      path: path.join(baseDir, "fonts/ui.ttf"),
      type: "font/ttf",
    });
    expect(definitions["./sprite.png"]).toMatchObject({
      kind: "local",
      path: path.join(baseDir, "sprite.png"),
      type: "image/png",
    });
    expect(definitions["./hover.mp3"]).toMatchObject({
      kind: "local",
      path: path.join(baseDir, "hover.mp3"),
      type: "audio/mpeg",
    });
    expect(definitions["./intro.mp4"]).toMatchObject({
      kind: "local",
      path: path.join(baseDir, "intro.mp4"),
      type: "video/mp4",
    });
  });
});

describe("parseBackgroundColor", () => {
  it("accepts string and numeric formats", () => {
    expect(parseBackgroundColor("#112233")).toBe(0x112233);
    expect(parseBackgroundColor("0x445566")).toBe(0x445566);
    expect(parseBackgroundColor(0x778899)).toBe(0x778899);
  });
});
