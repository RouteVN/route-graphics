import { VERSION } from "pixi.js";

export const PIXI_SNAPSHOT_RENDER_GROUP_VERSION = "8.10.2";

/**
 * Pixi 8.10.2 updates a render-group root's color when its parent changes, but
 * does not rebuild that root's own batched instructions. Snapshot staging and
 * restoration therefore need this narrow renderer integration when the caller
 * already owns a render group. Rebuilding instructions preserves the existing
 * group/cache/texture resources; disabling the group would destroy them.
 *
 * Keep the private instruction-dirty contract here. Never write cached color,
 * transform, or texture values to make a snapshot appear correct.
 */
export const invalidateSnapshotRenderGroup = (displayObject) => {
  const group = displayObject.renderGroup;
  if (!group) return;
  if (
    VERSION !== PIXI_SNAPSHOT_RENDER_GROUP_VERSION ||
    group.root !== displayObject ||
    typeof group.structureDidChange !== "boolean"
  ) {
    throw new Error(
      `Snapshot rendering is incompatible with the installed Pixi runtime; expected Pixi ${PIXI_SNAPSHOT_RENDER_GROUP_VERSION} render-group instructions.`,
    );
  }
  group.structureDidChange = true;
};
