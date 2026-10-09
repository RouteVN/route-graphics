import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { inspectTimelineDefinition } from "./inspectTimeline.js";
import { loadRenderDefinition } from "./renderConfig.js";
import {
  parseRouteGraphicsCliArgs,
  runRouteGraphicsCli,
} from "./routeGraphicsCli.js";

const source = `
states:
  - id: demo
    elements: []
    animations:
      - id: move
        targetId: hero
        type: update
        gsap:
          profile: portable-v1
          steps:
            - kind: mark
              name: entrance
            - kind: to
              values: { x: 100 }
              duration: 250
`;

describe("timeline inspector", () => {
  it("reports normalized authoring, semantic program, and visualization lanes", () => {
    const result = inspectTimelineDefinition({
      definition: loadRenderDefinition(source),
      stateIndex: 0,
      animationId: "move",
    });
    expect(result.animations[0]).toMatchObject({
      normalizedAst: { id: "move", gsap: { profile: "portable-v1" } },
      summary: { duration: 250, clipCount: 1, frontend: "gsap" },
      visualization: {
        marks: { entrance: 0 },
        lanes: [{ channel: "transform.x", start: 0, duration: 250 }],
      },
    });
    expect(result.animations[0].semanticSignature).toContain(
      '"schema":"route.timeline/v1"',
    );
  });

  it("parses and runs inspect-timeline without launching a browser", async () => {
    expect(
      parseRouteGraphicsCliArgs([
        "inspect-timeline",
        "scene.yaml",
        "--animation",
        "move",
        "--compact",
      ]),
    ).toMatchObject({
      command: "inspect-timeline",
      inputPath: "scene.yaml",
      animationId: "move",
      compact: true,
    });

    const stdout = {
      value: "",
      write(value) {
        this.value += value;
      },
    };
    const stderr = {
      value: "",
      write(value) {
        this.value += value;
      },
    };
    const exitCode = await runRouteGraphicsCli({
      argv: ["inspect-timeline", "virtual.yaml", "--compact"],
      cwd: "/virtual",
      stdout,
      stderr,
    });
    expect(exitCode).toBe(1);
    expect(stdout.value).toBe("");
    expect(stderr.value).toContain("ENOENT");
    expect(() =>
      parseRouteGraphicsCliArgs([
        "inspect-timeline",
        "scene.yaml",
        "--output",
        "ignored.json",
      ]),
    ).toThrow("--output is not supported by inspect-timeline");
  });

  it("preserves original animation indexes in source paths when filtering", () => {
    const result = inspectTimelineDefinition({
      definition: loadRenderDefinition(`
states:
  - elements: []
    animations:
      - id: first
        targetId: one
        type: update
        tween:
          x:
            keyframes: [{ value: 1, duration: 10 }]
      - id: second
        targetId: two
        type: update
        tween:
          x:
            keyframes: [{ value: 2, duration: 10 }]
`),
      animationId: "second",
    });
    expect(result.animations[0].visualization.lanes[0].sourcePath).toContain(
      "animations[1]",
    );
  });

  it.each([undefined, "move"])(
    "preserves authored indexes after dropping empty animations (selection: %s)",
    (animationId) => {
      const definition = {
        states: [
          { id: "unused" },
          {
            id: "with-empty-tracks",
            animations: [
              // A dropped duplicate id must not steal the live entry's index.
              { id: "move", targetId: "box", type: "update", tween: {} },
              {
                id: "empty-transition",
                targetId: "box",
                type: "transition",
                prev: {},
                next: { tween: {} },
              },
              {
                id: "move",
                targetId: "box",
                type: "update",
                tween: {
                  x: { keyframes: [{ value: 100, duration: 200 }] },
                  y: { keyframes: [] },
                },
              },
            ],
          },
        ],
      };
      const original = structuredClone(definition);
      const result = inspectTimelineDefinition({
        definition,
        stateIndex: 1,
        animationId,
      });

      expect(result.animations).toHaveLength(1);
      expect(result.animations[0].visualization.lanes[0].sourcePath).toContain(
        "states[1].animations[2]",
      );
      expect(result.animations[0].summary.duration).toBe(200);
      expect(definition).toEqual(original);
    },
  );

  it("returns an empty inspection when every authored animation is a no-op", () => {
    const result = inspectTimelineDefinition({
      definition: {
        states: [
          {
            animations: [
              { id: "empty", targetId: "box", type: "update", tween: {} },
            ],
          },
        ],
      },
    });
    expect(result.animations).toEqual([]);
  });

  it("compiles the checked-in portable GSAP example", () => {
    const example = fs.readFileSync(
      `${process.cwd()}/examples/portable-gsap.yaml`,
      "utf8",
    );
    const result = inspectTimelineDefinition({
      definition: loadRenderDefinition(example),
    });
    expect(result.animations[0].summary).toMatchObject({
      programId: "card-entrance",
      frontend: "gsap",
      eventCount: 1,
    });
  });
});
