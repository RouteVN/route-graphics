import { describe, expect, it, vi } from "vitest";
import { buildLine, GraphicsPath } from "pixi.js";
import {
  appendRectPath,
  resolveRenderedCornerRadius,
} from "../../src/plugins/elements/rect/rectDrawing.js";

const createGraphicsSpy = () => {
  const graphics = {};
  for (const method of [
    "rect",
    "moveTo",
    "lineTo",
    "quadraticCurveTo",
    "closePath",
  ]) {
    graphics[method] = vi.fn(() => graphics);
  }
  return graphics;
};

describe("rect rounded geometry", () => {
  it.each(Array.from({ length: 14 }, (_, index) => index + 1))(
    "keeps mixed square/rounded corners finite in the real Pixi stroke mesh (mask %i)",
    (mask) => {
      const corners = Object.fromEntries(
        ["topLeft", "topRight", "bottomRight", "bottomLeft"].map(
          (name, index) => [name, mask & (1 << index) ? 36 : 0],
        ),
      );
      const path = appendRectPath(new GraphicsPath(), 220, 180, corners);
      const polygon = path.shapePath.shapePrimitives[0].shape;

      // Duplicate consecutive points create zero-length edges. In Pixi's line
      // builder their normals divide by zero and corrupt the border mesh.
      for (let index = 2; index < polygon.points.length; index += 2) {
        expect(polygon.points.slice(index, index + 2)).not.toEqual(
          polygon.points.slice(index - 2, index),
        );
      }
      for (const width of [0.5, 6, 200]) {
        const vertices = [];
        const indices = [];
        buildLine(
          polygon.points,
          { alignment: 0.5, width, miterLimit: 10, join: "miter", cap: "butt" },
          false,
          true,
          vertices,
          indices,
        );
        expect(indices.length).toBeGreaterThan(0);
        expect(vertices.every(Number.isFinite)).toBe(true);
        expect(
          indices.every((index) => index >= 0 && index < vertices.length / 2),
        ).toBe(true);
      }
    },
  );

  it("uses the simple rectangle path when every radius is zero", () => {
    const graphics = createGraphicsSpy();

    appendRectPath(graphics, 120, 80, 0);

    expect(graphics.rect).toHaveBeenCalledWith(0, 0, 120, 80);
    expect(graphics.moveTo).not.toHaveBeenCalled();
  });

  it("draws all four corner radii independently", () => {
    const graphics = createGraphicsSpy();

    appendRectPath(graphics, 120, 80, {
      topLeft: 4,
      topRight: 8,
      bottomRight: 12,
      bottomLeft: 16,
    });

    expect(graphics.moveTo).toHaveBeenCalledWith(4, 0);
    expect(graphics.lineTo).toHaveBeenNthCalledWith(1, 112, 0);
    expect(graphics.quadraticCurveTo).toHaveBeenNthCalledWith(
      1,
      120,
      0,
      120,
      8,
    );
    expect(graphics.quadraticCurveTo).toHaveBeenNthCalledWith(
      2,
      120,
      80,
      108,
      80,
    );
    expect(graphics.quadraticCurveTo).toHaveBeenNthCalledWith(3, 0, 80, 0, 64);
    expect(graphics.quadraticCurveTo).toHaveBeenNthCalledWith(4, 0, 0, 4, 0);
    expect(graphics.closePath).toHaveBeenCalledOnce();
  });

  it("reduces oversized adjacent radii proportionally", () => {
    expect(
      resolveRenderedCornerRadius(
        {
          topLeft: 80,
          topRight: 80,
          bottomRight: 20,
          bottomLeft: 20,
        },
        100,
        60,
      ),
    ).toEqual({
      topLeft: 48,
      topRight: 48,
      bottomRight: 12,
      bottomLeft: 12,
    });
  });

  it("clamps animated negative dimensions without producing invalid paths", () => {
    const graphics = createGraphicsSpy();

    appendRectPath(graphics, -20, Number.NaN, 12);

    expect(graphics.rect).toHaveBeenCalledWith(0, 0, 0, 0);
  });
});
