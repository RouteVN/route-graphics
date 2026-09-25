import { describe, expect, it } from "vitest";
import {
  bindTimelineProgram,
  createGsapTimelineEvaluator,
  evaluateTimelineInstance,
} from "./index.js";

const constant = (value) => ({ kind: "constant", value });
const underlying = () => ({ kind: "underlying" });
const plusUnderlying = (value) => ({
  kind: "add",
  left: { kind: "underlying" },
  right: constant(value),
});
// 1 / (iteration - offset): valid at iteration 0, divides by zero once the
// refresh iteration reaches offset.
const oneOverIterationMinus = (offset) => ({
  kind: "divide",
  left: constant(1),
  right: {
    kind: "subtract",
    left: { kind: "iteration" },
    right: constant(offset),
  },
});

const interpolate = (from, to) => ({
  kind: "interpolate",
  from,
  to,
  easing: "linear",
});

const makeClip = (overrides) => ({
  id: "clip",
  sourcePath: "clip",
  domain: "root",
  targets: "self",
  fanout: null,
  channel: "transform.x",
  valueType: "scalar",
  start: 0,
  duration: 50,
  sampler: interpolate(underlying(), constant(100)),
  modifiers: [],
  composite: "replace",
  priority: 0,
  fill: "forwards",
  ...overrides,
});

// Root refresh domain: three 100ms iterations, two sibling clips per cycle.
const bindProgram = (clipTemplates, domainOverrides = {}) => {
  const program = {
    schema: "route.timeline/v1",
    timeUnit: "milliseconds",
    programId: "refresh-failure",
    ownerId: "hero",
    duration: 300,
    requirements: ["channel.transform2d", "target.element"],
    targetQueries: { self: { kind: "element", elementId: "hero" } },
    schedules: {},
    domains: {
      root: {
        parent: null,
        start: 0,
        cycleDuration: 100,
        iterations: 3,
        iterationGap: 0,
        direction: "forward",
        rate: 1,
        refresh: "iteration",
        ...domainOverrides,
      },
    },
    easings: { linear: { kind: "linear" } },
    clipTemplates,
    events: [],
  };
  return bindTimelineProgram(program, {
    capabilities: new Set(program.requirements),
    targetRegistry: { hero: { handle: { x: 0 }, identity: "hero" } },
    channelRegistry: {
      "transform.x": {
        get: (handle) => handle.x,
        apply: (handle, value) => {
          handle.x = value;
        },
      },
    },
  });
};

const bindLaterSegmentFailure = () =>
  bindProgram([
    makeClip({ id: "first", sourcePath: "first" }),
    makeClip({
      id: "second",
      sourcePath: "second",
      priority: 1,
      start: 50,
      // 1 / (iteration - 1): iteration 0 yields -1, iteration 1 divides by
      // zero after the first sibling's endpoints are already cached.
      sampler: interpolate(underlying(), oneOverIterationMinus(1)),
    }),
  ]);

describe("repeat-refresh failure atomicity", () => {
  it("rethrows the original expression error on every retry after a later segment fails", () => {
    const instance = bindLaterSegmentFailure();
    const sample = (time) =>
      evaluateTimelineInstance(instance, time).values[0].value;

    expect(sample(25)).toBe(50);
    expect(() => sample(150)).toThrow("second.to divides by zero.");
    expect(() => sample(150)).toThrow("second.to divides by zero.");
    expect(sample(25)).toBe(50);
  });

  it("rethrows the original expression error on every retry after the first segment fails", () => {
    const instance = bindProgram([
      makeClip({
        id: "first",
        sourcePath: "first",
        // 1 / (iteration - 2): fails while resolving iteration 2, before any
        // endpoint of that iteration is published.
        sampler: interpolate(underlying(), oneOverIterationMinus(2)),
      }),
      makeClip({
        id: "second",
        sourcePath: "second",
        priority: 1,
        start: 50,
        sampler: interpolate(underlying(), plusUnderlying(1)),
      }),
    ]);
    const sample = (time) =>
      evaluateTimelineInstance(instance, time).values[0].value;

    expect(sample(25)).toBe(-0.25);
    expect(sample(175)).toBeCloseTo(-0.5);
    expect(() => sample(250)).toThrow("first.to divides by zero.");
    expect(() => sample(250)).toThrow("first.to divides by zero.");
    expect(sample(25)).toBe(-0.25);
    expect(sample(175)).toBeCloseTo(-0.5);
  });

  it("rolls back a failed refresh after an alternating reverse iteration", () => {
    const instance = bindProgram(
      [
        makeClip({
          sampler: interpolate(underlying(), oneOverIterationMinus(2)),
        }),
      ],
      { direction: "alternate" },
    );
    const sample = (time) =>
      evaluateTimelineInstance(instance, time).values[0].value;
    expect(sample(25)).toBe(-0.25);
    expect(sample(175)).toBe(-0.25);
    expect(() => sample(250)).toThrow("clip.to divides by zero.");
    expect(() => sample(250)).toThrow("clip.to divides by zero.");
    expect(sample(175)).toBe(-0.25);
  });

  it("keeps the GSAP evaluator consistent across the same failure", () => {
    const evaluator = createGsapTimelineEvaluator(bindLaterSegmentFailure());
    const sample = (time) => evaluator.evaluate(time).values[0].value;
    try {
      expect(sample(25)).toBeCloseTo(50);
      expect(() => sample(150)).toThrow("second.to divides by zero.");
      expect(() => sample(150)).toThrow("second.to divides by zero.");
      expect(sample(25)).toBeCloseTo(50);
    } finally {
      evaluator.destroy();
    }
  });

  it("still publishes sibling endpoints incrementally on success, including out-of-order seeks", () => {
    const instance = bindProgram([
      makeClip({
        id: "grow",
        sourcePath: "grow",
        sampler: interpolate(underlying(), plusUnderlying(10)),
      }),
      makeClip({
        id: "settle",
        sourcePath: "settle",
        priority: 1,
        start: 50,
        // The settle capture must see grow's freshly computed endpoints for
        // the same iteration: 0→15, 15→30, 30→45 across the three iterations.
        sampler: interpolate(underlying(), plusUnderlying(5)),
      }),
    ]);
    const evaluator = createGsapTimelineEvaluator(instance);
    try {
      for (const [time, expected] of [
        [275, 42.5],
        [25, 5],
        [175, 27.5],
        [250, 40],
        [125, 20],
      ]) {
        expect(
          evaluateTimelineInstance(instance, time).values[0].value,
        ).toBeCloseTo(expected);
        expect(evaluator.evaluate(time).values[0].value).toBeCloseTo(expected);
      }
    } finally {
      evaluator.destroy();
    }
  });
});
