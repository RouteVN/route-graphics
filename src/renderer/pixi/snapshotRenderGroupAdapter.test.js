import { readFileSync } from "node:fs";
import { Container } from "pixi.js";
import { describe, expect, it } from "vitest";
import {
  invalidateSnapshotRenderGroup,
  PIXI_SNAPSHOT_RENDER_GROUP_VERSION,
} from "./snapshotRenderGroupAdapter.js";

describe("snapshot render-group adapter", () => {
  it("pins the exact renderer dependency", () => {
    const manifest = JSON.parse(readFileSync("package.json", "utf8"));
    expect(manifest.dependencies["pixi.js"]).toBe(
      PIXI_SNAPSHOT_RENDER_GROUP_VERSION,
    );
  });
  it("invalidates only instructions, retaining caller-owned group resources", () => {
    const node = new Container({ isRenderGroup: true });
    const group = node.renderGroup;
    group.structureDidChange = false;
    const before = { ...group };
    invalidateSnapshotRenderGroup(node);
    expect(node.renderGroup).toBe(group);
    expect({ ...group }).toEqual({ ...before, structureDidChange: true });
    node.destroy();
  });
  it("does not create a group for ordinary objects", () => {
    const node = new Container();
    invalidateSnapshotRenderGroup(node);
    expect(node.isRenderGroup).toBe(false);
    node.destroy();
  });
  it.each([{ structureDidChange: 0 }, { structureDidChange: false, root: {} }])(
    "fails explicitly on an incompatible group shape",
    (group) => {
      expect(() =>
        invalidateSnapshotRenderGroup({ renderGroup: group }),
      ).toThrow("incompatible with the installed Pixi runtime");
    },
  );
});
