import { Sprite, Texture } from "pixi.js";

/**
 * @typedef {import('../../types.js').Container} Container
 * @typedef {import('../../types.js').SpriteASTNode} SpriteASTNode
 */

/**
 * @param {Object} params
 * @param {import('../../types.js').Application} params.app
 * @param {Container} params.parent
 * @property {SpriteASTNode} spriteASTNode
 * @param {Object[]} params.animations
 * @param {AbortSignal} params.signal
 * @param {Function} params.animateElements
 */
export const addSprite = async ({
  app,
  parent,
  spriteASTNode,
  animations,
  eventHandler,
  animateElements,
  signal,
}) => {
  if (signal?.aborted) {
    return;
  }

  const { id, x, y, width, height, src, alpha } = spriteASTNode;
  const texture = src ? Texture.from(src) : Texture.EMPTY;
  const sprite = new Sprite(texture);
  sprite.label = id;

  const drawSprite = () => {
    sprite.x = x;
    sprite.y = y;
    sprite.width = width;
    sprite.height = height;
    sprite.alpha = alpha;
  };

  signal.addEventListener("abort", () => {
    drawSprite();
  });
  drawSprite();

  const hoverEvents = spriteASTNode?.hover;
  const clickEvents = spriteASTNode?.click;

  if (eventHandler && hoverEvents) {
    const { cursor, soundSrc, actionPayload } = hoverEvents;
    sprite.eventMode = "static";

    const overListener = () => {
      if (actionPayload)
        eventHandler(`${sprite.label}-pointer-over`, {
          _event: {
            id: sprite.label,
          },
          ...actionPayload,
        });
      if (cursor) sprite.cursor = cursor;
      if (soundSrc)
        app.audioStage.add({
          id: `hover-${Date.now()}`,
          url: soundSrc,
          loop: false,
        });
      if (hoverEvents?.src) {
        const hoverTexture = hoverEvents.src
          ? Texture.from(hoverEvents.src)
          : Texture.EMPTY;
        sprite.texture = hoverTexture;
      }
    };

    const outListener = () => {
      sprite.cursor = "auto";
      sprite.texture = texture;
    };

    sprite.on("pointerover", overListener);
    sprite.on("pointerout", outListener);
  }

  if (eventHandler && clickEvents) {
    const { soundSrc, actionPayload } = clickEvents;
    sprite.eventMode = "static";

    const clickListener = () => {
      // Apply click texture during pointerdown
      if (clickEvents?.src) {
        const clickTexture = clickEvents.src
          ? Texture.from(clickEvents.src)
          : Texture.EMPTY;
        sprite.texture = clickTexture;
      }
    };

    const releaseListener = () => {
      // Restore original texture on pointerup
      sprite.texture = texture;

      // Trigger event and sound on pointerup
      if (actionPayload)
        eventHandler(`${sprite.label}-click`, {
          _event: {
            id: sprite.label,
          },
          ...actionPayload,
        });
      if (soundSrc)
        app.audioStage.add({
          id: `click-${Date.now()}`,
          url: soundSrc,
          loop: false,
        });
    };

    const outListener = () => {
      // Restore original texture on pointerout
      sprite.texture = texture;
    };

    sprite.on("pointerdown", clickListener);
    sprite.on("pointerup", releaseListener);
    sprite.on("pointerupoutside", outListener);
  }

  parent.addChild(sprite);

  if (animations && animations.length > 0) {
    await animateElements(id, {
      app,
      displayObject: sprite,
      animations,
      signal,
    });
  }
};
