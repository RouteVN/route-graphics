import { Sprite, Texture } from "pixi.js";

/**
 * @param {Object} params
 * @param {import('../types.js').Application} params.app
 * @param {Container} params.parent
 * @property {SpriteASTNode} spriteASTNode
 * @param {Object[]} params.transitions
 * @param {AbortSignal} params.signal
 * @param {Function} params.transitionElements
 */
export async function renderSprite({
  app,
  parent,
  spriteASTNode,
  transitions,
  eventHandler,
  transitionElements,
  signal,
}) {
  if (signal?.aborted) {
    reject(new DOMException("Operation aborted", "AbortError"));
    return;
  }

  const { id, x, y, width, height, url, alpha, zIndex } = spriteASTNode;
  const texture = url ? Texture.from(url) : Texture.EMPTY;
  const sprite = new Sprite(texture);
  sprite.label = id;

  const drawSprite = () => {
    sprite.x = x;
    sprite.y = y;
    sprite.width = width;
    sprite.height = height;
    sprite.alpha = alpha;
    sprite.zIndex = zIndex;
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
      if (clickEvents?.src) {
        const clickTexture = clickEvents.src
          ? Texture.from(clickEvents.src)
          : Texture.EMPTY;
        sprite.texture = clickTexture;
      }
    };

    sprite.on("pointerup", clickListener);
  }

  parent.addChild(sprite);

  if (transitions && transitions.length > 0) {
    await transitionElements(id, { app, sprite, transitions, signal });
  }
}
