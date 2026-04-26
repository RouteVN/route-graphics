import { describe, expect, it } from "vitest";

import {
  getBlurTargetState,
  hasBlurUpdateAnimation,
  normalizeBlurConfig,
  syncBlurEffect,
} from "../../src/plugins/elements/util/blurEffect.js";

describe("blurEffect", () => {
  it("normalizes blur config and fills static defaults", () => {
    expect(normalizeBlurConfig({ x: 2, y: 4 })).toEqual({
      x: 2,
      y: 4,
      quality: 4,
      kernelSize: 5,
      repeatEdgePixels: false,
    });
  });

  it("requires explicit x and y axes", () => {
    expect(() => normalizeBlurConfig({ x: 2 })).toThrow(
      "blur.x and blur.y are required",
    );
    expect(() => normalizeBlurConfig(2)).toThrow("blur must be an object");
  });

  it("applies and reuses a managed blur filter", () => {
    const displayObject = {};

    syncBlurEffect(displayObject, normalizeBlurConfig({ x: 3, y: 5 }));

    expect(displayObject.filters).toHaveLength(1);
    expect(displayObject._routeGraphicsBlur.x).toBe(3);
    expect(displayObject._routeGraphicsBlur.y).toBe(5);

    const filter = displayObject.filters[0];
    displayObject._routeGraphicsBlur.x = 7;
    displayObject._routeGraphicsBlur.y = 9;

    expect(filter.strengthX).toBe(7);
    expect(filter.strengthY).toBe(9);

    syncBlurEffect(displayObject, normalizeBlurConfig({ x: 1, y: 2 }));

    expect(displayObject.filters[0]).toBe(filter);
    expect(displayObject._routeGraphicsBlur.x).toBe(1);
    expect(displayObject._routeGraphicsBlur.y).toBe(2);
  });

  it("preserves unmanaged filters while removing managed blur", () => {
    const displayObject = {
      filters: [{ label: "custom" }],
    };

    syncBlurEffect(displayObject, normalizeBlurConfig({ x: 3, y: 5 }));
    expect(displayObject.filters).toHaveLength(2);

    syncBlurEffect(displayObject, undefined);

    expect(displayObject.filters).toEqual([{ label: "custom" }]);
    expect(displayObject._routeGraphicsBlur).toBeUndefined();
  });

  it("detects blur animations and exposes blur target state only when needed", () => {
    const animations = new Map([
      [
        "sprite-1",
        [
          {
            id: "blur-in",
            targetId: "sprite-1",
            type: "update",
            tween: { blurX: { keyframes: [] } },
          },
        ],
      ],
    ]);

    expect(hasBlurUpdateAnimation(animations, "sprite-1")).toBe(true);
    expect(hasBlurUpdateAnimation(animations, "sprite-2")).toBe(false);
    expect(getBlurTargetState({ blur: { x: 4, y: 6 } })).toEqual({
      blurX: 4,
      blurY: 6,
    });
    expect(getBlurTargetState({}, { force: true })).toEqual({
      blurX: 0,
      blurY: 0,
    });
    expect(getBlurTargetState({})).toEqual({});
  });
});
