import { describe, expect, it, vi } from "vitest";
import { setManagedFilter } from "./managedFilters.js";

describe("setManagedFilter", () => {
  it("keeps managed filters ordered and flattens shader filter stacks", () => {
    const displayObject = {};
    const unmanaged = { id: "unmanaged" };
    const shadow = { id: "shadow" };
    const blur = { id: "blur" };
    const shaderA = { id: "shaderA" };
    const shaderB = { id: "shaderB" };

    displayObject.filters = [unmanaged];

    setManagedFilter(displayObject, "shader", [shaderA, shaderB]);
    setManagedFilter(displayObject, "shadow", shadow);
    setManagedFilter(displayObject, "blur", blur);

    expect(displayObject.filters).toEqual([
      shadow,
      blur,
      shaderA,
      shaderB,
      unmanaged,
    ]);
  });

  it("destroys every previous managed filter when replacing a stack", () => {
    const displayObject = {};
    const oldA = { destroy: vi.fn() };
    const oldB = { destroy: vi.fn() };
    const next = { destroy: vi.fn() };

    setManagedFilter(displayObject, "shader", [oldA, oldB]);
    setManagedFilter(displayObject, "shader", [next]);

    expect(oldA.destroy).toHaveBeenCalledTimes(1);
    expect(oldB.destroy).toHaveBeenCalledTimes(1);
    expect(next.destroy).not.toHaveBeenCalled();
  });
});
