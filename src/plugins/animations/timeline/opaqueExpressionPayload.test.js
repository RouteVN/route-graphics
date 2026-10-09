import { describe, expect, it } from "vitest";
import {
  bindTimelineProgram,
  evaluateTimelineInstance,
  validateTimelineProgram,
} from "./index.js";

// Authored payloads routinely embed objects that merely look like expressions
// (a "kind" field named "iteration"). Only discrete channels accept them, and
// bindProgram must treat them as opaque data, not as iteration references.
const opaquePayload = {
  kind: "iteration",
  frames: [
    { kind: "iteration", index: 1 },
    { kind: "constant", value: [{ kind: "min", values: [0] }] },
  ],
  labels: { nested: { kind: "iteration" } },
};

const createDiscreteProgram = () => ({
  schema: "route.timeline/v1",
  timeUnit: "milliseconds",
  programId: "opaque-payload",
  ownerId: "hero",
  duration: 100,
  requirements: ["target.element"],
  targetQueries: {
    self: { kind: "element", elementId: "hero" },
  },
  schedules: {},
  domains: {
    root: {
      parent: null,
      start: 0,
      cycleDuration: 100,
      iterations: 1,
      iterationGap: 0,
      direction: "forward",
      rate: 1,
      refresh: "never",
    },
  },
  easings: {
    linear: { kind: "linear" },
  },
  clipTemplates: [
    {
      id: "clip-0",
      sourcePath: "animations[0].tween.state.keyframes[0]",
      domain: "root",
      targets: "self",
      fanout: null,
      channel: "state.mode",
      valueType: "discrete",
      start: 0,
      duration: 100,
      sampler: {
        kind: "interpolate",
        from: { kind: "underlying" },
        to: { kind: "constant", value: null },
        easing: "linear",
      },
      modifiers: [],
      composite: "replace",
      priority: 0,
      fill: "forwards",
    },
  ],
  events: [],
  debug: { source: "opaqueExpressionPayload.test" },
});

const createScalarProgram = () => {
  const source = createDiscreteProgram();
  source.clipTemplates[0] = {
    ...source.clipTemplates[0],
    sourcePath: "animations[0].tween.x.keyframes[0]",
    channel: "transform.x",
    valueType: "scalar",
    sampler: {
      kind: "interpolate",
      from: { kind: "underlying" },
      to: { kind: "constant", value: 1 },
      easing: "linear",
    },
  };
  return source;
};

const bindProgram = (source) => {
  const program = validateTimelineProgram(source);
  return bindTimelineProgram(program, {
    capabilities: new Set(program.requirements),
    targetRegistry: { hero: { mode: "idle", x: 0 } },
    channelRegistry: {
      "state.mode": {
        get: (handle) => handle.mode,
        apply: (handle, value) => {
          handle.mode = value;
        },
      },
      "transform.x": {
        get: (handle) => handle.x,
        apply: (handle, value) => {
          handle.x = value;
        },
      },
    },
  });
};

describe("opaque expression payloads", () => {
  it("binds and preserves constants whose payloads embed iteration-shaped JSON", () => {
    const source = createDiscreteProgram();
    source.clipTemplates[0].sampler.from = {
      kind: "constant",
      value: { kind: "iteration" },
    };
    source.clipTemplates[0].sampler.to = {
      kind: "constant",
      value: opaquePayload,
    };

    const instance = bindProgram(source);
    const segment = instance.tracks[0].segments[0];
    expect(segment.from).toEqual({ kind: "iteration" });
    expect(segment.to).toEqual(opaquePayload);

    expect(evaluateTimelineInstance(instance, 0).values[0].value).toEqual({
      kind: "iteration",
    });
    expect(evaluateTimelineInstance(instance, 100).values[0].value).toEqual(
      opaquePayload,
    );
  });

  it("binds randomChoice payloads embedding iteration-shaped JSON deterministically", () => {
    const choices = [
      { kind: "iteration", label: "first" },
      { kind: "constant", value: [{ kind: "iteration" }] },
    ];
    const buildSource = () => {
      const source = createDiscreteProgram();
      source.clipTemplates[0].sampler.from = {
        kind: "randomChoice",
        seed: "opaque-choices",
        choices,
      };
      source.clipTemplates[0].sampler.to = {
        kind: "constant",
        value: { kind: "iteration", terminal: true },
      };
      return source;
    };

    const instance = bindProgram(buildSource());
    const segment = instance.tracks[0].segments[0];
    expect(choices).toContainEqual(segment.from);

    const replay = bindProgram(buildSource()).tracks[0].segments[0];
    expect(replay.from).toEqual(segment.from);

    expect(choices).toContainEqual(
      evaluateTimelineInstance(instance, 0).values[0].value,
    );
    expect(evaluateTimelineInstance(instance, 100).values[0].value).toEqual({
      kind: "iteration",
      terminal: true,
    });
  });

  it.each([
    [
      "add",
      {
        kind: "add",
        left: { kind: "iteration" },
        right: { kind: "constant", value: 1 },
      },
    ],
    [
      "subtract",
      {
        kind: "subtract",
        left: { kind: "constant", value: 5 },
        right: { kind: "iteration" },
      },
    ],
    [
      "multiply",
      {
        kind: "multiply",
        left: { kind: "iteration" },
        right: { kind: "constant", value: 2 },
      },
    ],
    [
      "divide",
      {
        kind: "divide",
        left: { kind: "iteration" },
        right: { kind: "constant", value: 2 },
      },
    ],
    [
      "min",
      {
        kind: "min",
        values: [{ kind: "constant", value: 0 }, { kind: "iteration" }],
      },
    ],
    [
      "max",
      {
        kind: "max",
        values: [{ kind: "iteration" }, { kind: "constant", value: 1 }],
      },
    ],
    [
      "clamp",
      {
        kind: "clamp",
        value: { kind: "constant", value: 5 },
        min: { kind: "iteration" },
        max: { kind: "constant", value: 10 },
      },
    ],
  ])(
    "still rejects real iteration inside %s outside repeatRefresh",
    (_kind, wrapper) => {
      const source = createScalarProgram();
      source.clipTemplates[0].sampler.from = wrapper;
      expect(() => bindProgram(source)).toThrow(
        /uses iteration outside repeatRefresh/,
      );
    },
  );

  it("still rejects real iteration on the to endpoint outside repeatRefresh", () => {
    const source = createScalarProgram();
    source.clipTemplates[0].sampler.to = {
      kind: "add",
      left: { kind: "constant", value: 1 },
      right: { kind: "iteration" },
    };
    expect(() => bindProgram(source)).toThrow(
      /uses iteration outside repeatRefresh/,
    );
  });

  it("accepts real iteration inside repeatRefresh and refreshes per occurrence", () => {
    const source = createScalarProgram();
    source.duration = 200;
    source.domains.root = {
      ...source.domains.root,
      cycleDuration: 100,
      iterations: 2,
      refresh: "iteration",
    };
    source.clipTemplates[0].sampler.from = {
      kind: "add",
      left: { kind: "iteration" },
      right: { kind: "constant", value: 10 },
    };
    source.clipTemplates[0].sampler.to = { kind: "constant", value: 30 };

    const instance = bindProgram(source);
    expect(evaluateTimelineInstance(instance, 0).values[0].value).toBe(10);
    expect(evaluateTimelineInstance(instance, 100).values[0].value).toBe(11);
  });
});
