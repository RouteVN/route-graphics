import { describe, expect, it } from "vitest";
import {
  installShaderProgressProperty,
  resetShaderFilterProgress,
  shouldUpdateUnchangedShaderFilterProgress,
} from "./shaderFilterEffect.js";

describe("shader filter progress state", () => {
  it("resets an installed shader progress property to the base value", () => {
    const displayObject = {};

    installShaderProgressProperty(displayObject);
    displayObject.uProgress = 1;
    resetShaderFilterProgress(displayObject);

    expect(displayObject.uProgress).toBe(0);
  });

  it("requests an unchanged update when a shader filter has stale progress", () => {
    const displayObject = { label: "shader-target" };
    const parent = { children: [displayObject] };

    installShaderProgressProperty(displayObject);
    displayObject.uProgress = 1;

    expect(
      shouldUpdateUnchangedShaderFilterProgress({
        parent,
        nextElement: {
          id: "shader-target",
          filters: [{ id: "grade", type: "shader" }],
        },
        animations: [],
      }),
    ).toBe(true);
  });

  it("does not request an unchanged update while uProgress is actively animated", () => {
    const displayObject = { label: "shader-target" };
    const parent = { children: [displayObject] };

    installShaderProgressProperty(displayObject);
    displayObject.uProgress = 1;

    expect(
      shouldUpdateUnchangedShaderFilterProgress({
        parent,
        nextElement: {
          id: "shader-target",
          filters: [{ id: "grade", type: "shader" }],
        },
        animations: [
          {
            id: "progress",
            targetId: "shader-target",
            type: "update",
            tween: { uProgress: { initialValue: 0, keyframes: [] } },
          },
        ],
      }),
    ).toBe(false);
  });

  it("finds stale shader progress in unchanged descendants", () => {
    const childDisplayObject = { label: "child-shader" };
    const containerDisplayObject = {
      label: "container",
      children: [childDisplayObject],
    };
    const parent = { children: [containerDisplayObject] };

    installShaderProgressProperty(childDisplayObject);
    childDisplayObject.uProgress = 0.5;

    expect(
      shouldUpdateUnchangedShaderFilterProgress({
        parent,
        nextElement: {
          id: "container",
          children: [
            {
              id: "child-shader",
              filters: [{ id: "grade", type: "shader" }],
            },
          ],
        },
        animations: [],
      }),
    ).toBe(true);
  });
});
