import { Rectangle, Texture } from "pixi.js";

/**
 * Interaction images change pixels, not the sprite's local coordinate system.
 * Pixi otherwise changes scale on texture assignment, leaving the pivot and
 * cached event transform in the previous texture's units. Texture views share
 * the actual source/frame/UVs; there is no image copy or extra GPU allocation.
 */
export const createInteractionTextureSetter = (sprite, baseTexture) => {
  sprite._cleanupInteractionTextures?.();
  const views = new Map();
  const cleanup = () => {
    sprite.off?.("destroyed", cleanup);
    for (const view of views.values()) {
      // Pixi 8.10's destroy(false) does not unregister this source listener.
      // Detach only our view, never the shared asset texture or its source.
      view.source.off("resize", view.update, view);
      view.destroy(false);
    }
    views.clear();
    if (sprite._cleanupInteractionTextures === cleanup) {
      delete sprite._cleanupInteractionTextures;
    }
  };
  sprite._cleanupInteractionTextures = cleanup;
  sprite.once?.("destroyed", cleanup);

  return (texture) => {
    let selected = texture;
    if (
      texture !== baseTexture &&
      (texture.orig.width !== baseTexture.orig.width ||
        texture.orig.height !== baseTexture.orig.height)
    ) {
      selected = views.get(texture);
      if (!selected) {
        const scaleX = baseTexture.orig.width / texture.orig.width;
        const scaleY = baseTexture.orig.height / texture.orig.height;
        selected = new Texture({
          source: texture.source,
          frame: texture.frame,
          orig: new Rectangle(
            0,
            0,
            baseTexture.orig.width,
            baseTexture.orig.height,
          ),
          trim: texture.trim
            ? new Rectangle(
                texture.trim.x * scaleX,
                texture.trim.y * scaleY,
                texture.trim.width * scaleX,
                texture.trim.height * scaleY,
              )
            : undefined,
          rotate: texture.rotate,
        });
        views.set(texture, selected);
      }
    }
    if (sprite.texture === selected) return;
    const scaleX = sprite.scale?.x;
    const scaleY = sprite.scale?.y;
    sprite.texture = selected;
    // Texture assignment reapplies Pixi's last explicit width/height, which may
    // precede a live scale animation. Both images now use the same units, so the
    // actual current scale (including a collapsed axis) is the correct value.
    sprite.scale?.set(scaleX, scaleY);
  };
};
