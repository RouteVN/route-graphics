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
  it("collects explicit aliases when render-state references use top-level assets", () => {
    const baseDir = path.resolve("/tmp/route-graphics");
    const states = [
      {
        id: "demo",
        elements: [
          {
            id: "title",
            type: "text",
            content: "Hello",
            textStyle: {
              fontFamily: "uiFont",
            },
          },
          {
            id: "sprite",
            type: "sprite",
            src: "hero",
            hover: {
              src: "hero-hover",
              soundSrc: "hover-sfx",
            },
          },
          {
            id: "movie",
            type: "video",
            src: "intro-video",
          },
        ],
      },
    ];

    const definitions = collectAssetDefinitions({
      baseDir,
      states,
      assets: {
        hero: "./hero.png",
        "hero-hover": "./hero-hover.png",
        "hover-sfx": "./hover.mp3",
        "intro-video": "./intro.mp4",
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
    expect(definitions["hero-hover"]).toMatchObject({
      kind: "local",
      path: path.join(baseDir, "hero-hover.png"),
      type: "image/png",
    });
    expect(definitions["hover-sfx"]).toMatchObject({
      kind: "local",
      path: path.join(baseDir, "hover.mp3"),
      type: "audio/mpeg",
    });
    expect(definitions["intro-video"]).toMatchObject({
      kind: "local",
      path: path.join(baseDir, "intro.mp4"),
      type: "video/mp4",
    });
  });

  it("throws when a render-state asset reference uses a direct path", () => {
    expect(() =>
      collectAssetDefinitions({
        baseDir: path.resolve("/tmp/route-graphics"),
        states: [
          {
            id: "demo",
            elements: [
              {
                id: "sprite",
                type: "sprite",
                src: "./sprite.png",
              },
            ],
          },
        ],
        assets: {
          hero: "./hero.png",
        },
      }),
    ).toThrow(/Direct asset references are not supported/);
  });

  it("accepts aliases that look like file paths", () => {
    const baseDir = path.resolve("/tmp/route-graphics");

    const definitions = collectAssetDefinitions({
      baseDir,
      states: [
        {
          id: "demo",
          elements: [
            {
              id: "sprite-a",
              type: "sprite",
              src: "hero.png",
            },
            {
              id: "sprite-b",
              type: "sprite",
              src: "icons/hero",
            },
          ],
        },
      ],
      assets: {
        "hero.png": "./hero.png",
        "icons/hero": "./icons/hero.png",
      },
    });

    expect(definitions["hero.png"]).toMatchObject({
      kind: "local",
      path: path.join(baseDir, "hero.png"),
      type: "image/png",
    });
    expect(definitions["icons/hero"]).toMatchObject({
      kind: "local",
      path: path.join(baseDir, "icons/hero.png"),
      type: "image/png",
    });
  });

  it("throws when a referenced asset alias is missing from top-level assets", () => {
    expect(() =>
      collectAssetDefinitions({
        baseDir: path.resolve("/tmp/route-graphics"),
        states: [
          {
            id: "demo",
            elements: [
              {
                id: "sprite",
                type: "sprite",
                src: "hero",
              },
            ],
          },
        ],
        assets: {},
      }),
    ).toThrow(/Asset alias "hero" referenced/);
  });

  it("infers string-asset mime types from the selected usage", () => {
    const definitions = collectAssetDefinitions({
      baseDir: path.resolve("/tmp/route-graphics"),
      states: [
        {
          id: "demo",
          elements: [
            {
              id: "poster",
              type: "sprite",
              src: "poster-stream",
            },
            {
              id: "movie",
              type: "video",
              src: "intro-stream",
            },
          ],
          audio: [
            {
              id: "narration",
              type: "sound",
              src: "narration-stream",
            },
          ],
        },
      ],
      assets: {
        "poster-stream": "https://cdn.example.com/download?id=poster",
        "intro-stream": "https://cdn.example.com/download?id=video",
        "narration-stream": "https://cdn.example.com/download?id=audio",
      },
    });

    expect(definitions["poster-stream"]).toMatchObject({
      kind: "remote",
      type: "image/png",
      url: "https://cdn.example.com/download?id=poster",
    });
    expect(definitions["intro-stream"]).toMatchObject({
      kind: "remote",
      type: "video/mp4",
      url: "https://cdn.example.com/download?id=video",
    });
    expect(definitions["narration-stream"]).toMatchObject({
      kind: "remote",
      type: "audio/mpeg",
      url: "https://cdn.example.com/download?id=audio",
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
