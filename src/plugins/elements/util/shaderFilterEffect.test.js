import { describe, expect, it } from "vitest";
import {
  installShaderProgressProperty,
  resetShaderFilterProgress,
} from "./shaderFilterEffect.js";

describe("shader filter progress state", () => {
  it("resets an installed shader progress property to the base value", () => {
    const displayObject = {};

    installShaderProgressProperty(displayObject);
    displayObject.uProgress = 1;
    resetShaderFilterProgress(displayObject);

    expect(displayObject.uProgress).toBe(0);
  });
});
