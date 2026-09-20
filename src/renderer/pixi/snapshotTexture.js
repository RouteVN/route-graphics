import { Container } from "pixi.js";
import { invalidateSnapshotRenderGroup } from "./snapshotRenderGroupAdapter.js";

/**
 * Render the existing object under a temporary root without promoting it.
 * This does not remount source elements or replace controller/resources.
 * Public reparenting emits added/removed; restoration/layer-order behavior is
 * shared by transition snapshots and public labelled extraction.
 *
 * Transitions neutralize alpha before applying it to their wrapper. Public
 * extraction preserves the selected root's own alpha, but not ancestor alpha.
 */
export const generateSnapshotTexture = ({
  renderer,
  displayObject,
  frame,
  preserveAlpha = false,
}) => {
  const originalParent = displayObject.parent;
  const originalIndex = originalParent?.getChildIndex(displayObject);
  const originalLayer = displayObject.parentRenderLayer;
  const originalLayerOrder = originalLayer
    ? [...originalLayer.renderLayerChildren]
    : null;
  // Validate an existing group's renderer contract before moving the object.
  invalidateSnapshotRenderGroup(displayObject);
  const original = {
    x: displayObject.x ?? 0,
    y: displayObject.y ?? 0,
    scaleX: displayObject.scale?.x ?? 1,
    scaleY: displayObject.scale?.y ?? 1,
    rotation: displayObject.rotation ?? 0,
    alpha: displayObject.alpha ?? 1,
    skewX: displayObject.skew?.x ?? 0,
    skewY: displayObject.skew?.y ?? 0,
    pivotX: displayObject.pivot?.x ?? 0,
    pivotY: displayObject.pivot?.y ?? 0,
  };
  // GenerateTexture promotes its target to a render group. In Pixi 8.10.2,
  // promoting an already-rendered Graphics/Text leaves its batch color or
  // transform cached in the old group. Keep the real object a child instead:
  // public reparenting makes Pixi refresh both, without changing its own group
  // or cache-as-texture ownership. This emits ordinary added/removed events.
  const captureRoot = new Container();
  // Keep the staged object's own render-group/batch alpha neutral even when
  // preserving public extraction opacity: a renderable group root participates
  // in both paths in Pixi 8.10.2. The temporary parent applies the selected
  // root's opacity once, using public properties and without touching caches.
  captureRoot.alpha = preserveAlpha ? original.alpha : 1;
  const failures = [];
  const restore = (operation) => {
    try {
      operation();
    } catch (error) {
      failures.push(error);
    }
  };
  let texture;

  try {
    // An object can be layer-attached even without a scene parent. Detach it
    // explicitly rather than relying on removeChild's implicit layer detach.
    originalLayer?.detach(displayObject);
    captureRoot.addChild(displayObject);
    displayObject.x = 0;
    displayObject.y = 0;
    displayObject.scale?.set?.(1, 1);
    displayObject.rotation = 0;
    displayObject.alpha = 1;
    displayObject.skew?.set?.(0, 0);
    // A direct render root ignored its pivot. As a child, explicitly remove
    // it here. Transition callers apply it to their snapshot sprite; public
    // labelled extraction intentionally excludes the selected root transform.
    displayObject.pivot?.set?.(0, 0);
    displayObject.updateLocalTransform?.();

    texture = renderer.generateTexture({
      target: captureRoot,
      frame,
    });
  } catch (error) {
    failures.push(error);
  } finally {
    // Restore transforms before emitting reparent events. A throwing listener
    // must not skip the remaining restoration or leak the temporary root.
    restore(() => {
      displayObject.x = original.x;
      displayObject.y = original.y;
      displayObject.scale?.set?.(original.scaleX, original.scaleY);
      displayObject.rotation = original.rotation;
      displayObject.alpha = original.alpha;
      displayObject.skew?.set?.(original.skewX, original.skewY);
      displayObject.pivot?.set?.(original.pivotX, original.pivotY);
      displayObject.updateLocalTransform?.();
    });
    restore(() => invalidateSnapshotRenderGroup(displayObject));
    restore(() => {
      if (displayObject.parent !== originalParent) {
        displayObject.removeFromParent();
      }
    });
    restore(() => {
      if (originalParent && displayObject.parent !== originalParent) {
        originalParent.addChildAt(displayObject, originalIndex);
      }
    });
    restore(() => {
      if (!originalLayer) return;
      if (
        displayObject.parentRenderLayer === originalLayer &&
        originalLayer.renderLayerChildren.length ===
          originalLayerOrder.length &&
        originalLayer.renderLayerChildren.every(
          (child, index) => child === originalLayerOrder[index],
        )
      )
        return;
      const remaining = originalLayerOrder.filter(
        (child) => child !== displayObject,
      );
      if (
        displayObject.parentRenderLayer ||
        originalLayer.renderLayerChildren.length !== remaining.length ||
        !originalLayer.renderLayerChildren.every(
          (child, index) => child === remaining[index],
        )
      ) {
        throw new Error(
          "Snapshot render-layer membership changed during capture",
        );
      }
      // attach() appends, and exposes no insertion index. Both public layer
      // APIs are event-free in the pinned Pixi version; move only the suffix
      // to recover the original order without changing options or the prefix.
      const suffix = originalLayerOrder.slice(
        originalLayerOrder.indexOf(displayObject) + 1,
      );
      originalLayer.detach(...suffix);
      originalLayer.attach(displayObject, ...suffix);
    });
    // Descendants attached to a layer outside the captured subtree retain
    // Pixi's existing exclusion semantics; this does not relocate their layer.
    restore(() => captureRoot.destroy({ children: false }));
  }
  if (failures.length > 0) {
    // The renderer may have succeeded before a restoration listener failed.
    // No caller can own that texture when this operation throws.
    restore(() => texture?.destroy(true));
    if (failures.length === 1) throw failures[0];
    throw new AggregateError(
      failures,
      "Snapshot capture or restoration failed",
    );
  }
  return texture;
};

export const extractSnapshotBase64 = async ({
  renderer,
  displayObject,
  frame,
}) => {
  const texture = generateSnapshotTexture({
    renderer,
    displayObject,
    frame,
    preserveAlpha: true,
  });
  const failures = [];
  let result;
  try {
    result = await renderer.extract.base64({ target: texture });
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      texture.destroy(true);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) {
    throw new AggregateError(failures, "Snapshot encoding or cleanup failed");
  }
  return result;
};
