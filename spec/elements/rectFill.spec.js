import { FillGradient } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import {
  destroyRectFillResource,
  normalizeRectFill,
  resolveRectFill,
} from "../../src/plugins/elements/rect/rectFill.js";

describe("rectFill", () => {
  it("normalizes transparent fill values to a transparent Pixi fill style", () => {
    expect(normalizeRectFill(undefined)).toEqual({ color: 0x000000, alpha: 0 });
    expect(normalizeRectFill("transparent")).toEqual({
      color: 0x000000,
      alpha: 0,
    });
  });

  it("keeps solid string and object fills backward compatible", () => {
    expect(normalizeRectFill("#ffcc00")).toBe("#ffcc00");
    expect(
      normalizeRectFill({
        type: "solid",
        color: "#112233",
      }),
    ).toBe("#112233");
  });

  it("maps linear gradient fills to FillGradient with sorted stops", () => {
    const fill = normalizeRectFill({
      type: "linear-gradient",
      start: { x: 1, y: 0 },
      end: { x: 0, y: 1 },
      stops: [
        { offset: 1, color: "#0000ff" },
        { offset: 0, color: "#ff0000" },
      ],
      coordinateSpace: "global",
      textureSize: 128,
      wrapMode: "repeat",
    });

    expect(fill).toBeInstanceOf(FillGradient);
    expect(fill.type).toBe("linear");
    expect(fill.start).toEqual({ x: 1, y: 0 });
    expect(fill.end).toEqual({ x: 0, y: 1 });
    expect(fill.textureSpace).toBe("global");
    expect(fill.colorStops.map((stop) => stop.offset)).toEqual([0, 1]);
    fill.destroy();
  });

  it("maps radial gradient fills to FillGradient with radial properties", () => {
    const fill = normalizeRectFill({
      type: "radial-gradient",
      innerCenter: { x: 0.25, y: 0.3 },
      innerRadius: 0.1,
      outerCenter: { x: 0.75, y: 0.8 },
      outerRadius: 0.9,
      stops: [
        { offset: 0, color: "#ffffff" },
        { offset: 1, color: "#000000" },
      ],
      coordinateSpace: "local",
      textureSize: 512,
      wrapMode: "clamp-to-edge",
      scale: 0.8,
      rotation: 0.4,
    });

    expect(fill).toBeInstanceOf(FillGradient);
    expect(fill.type).toBe("radial");
    expect(fill.center).toEqual({ x: 0.25, y: 0.3 });
    expect(fill.innerRadius).toBe(0.1);
    expect(fill.outerCenter).toEqual({ x: 0.75, y: 0.8 });
    expect(fill.outerRadius).toBe(0.9);
    expect(fill.scale).toBe(0.8);
    expect(fill.rotation).toBe(0.4);
    fill.destroy();
  });

  it("destroys previous gradient resources before replacing them", () => {
    const previousFillResource = { destroy: vi.fn() };
    const rect = { _rtglFillResource: previousFillResource };

    const nextFill = resolveRectFill(rect, "#445566");

    expect(previousFillResource.destroy).toHaveBeenCalledTimes(1);
    expect(nextFill).toBe("#445566");
    expect(rect._rtglFillResource).toBeUndefined();
  });

  it("stores created gradients on the graphics object for later cleanup", () => {
    const rect = {};

    const fill = resolveRectFill(rect, {
      type: "linear-gradient",
      stops: [
        { offset: 0, color: "#ff0000" },
        { offset: 1, color: "#0000ff" },
      ],
    });

    expect(fill).toBeInstanceOf(FillGradient);
    expect(rect._rtglFillResource).toBe(fill);

    destroyRectFillResource(rect);
    expect(rect._rtglFillResource).toBeUndefined();
  });
});
