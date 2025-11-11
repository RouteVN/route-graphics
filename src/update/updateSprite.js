import { Texture } from "pixi.js";

/**
 * Update function for Sprite elements
 * @typedef {import('../types.js').SpriteASTNode} SpriteASTNode
 * @typedef {import('pixi.js').Container} Container
 */

/**
 * @param {Object} params
 * @param {import('../types.js').Application} params.app
 * @param {Container} params.parent
 * @param {SpriteASTNode} params.prevSpriteASTNode
 * @param {SpriteASTNode} params.nextSpriteASTNode
 * @param {Object[]} params.transitions
 * @param {Function} eventHandler
 * @param {AbortSignal} params.signal
 * @param {Function} params.transitionElements
 */
export async function updateSprite({
  app,
  parent,
  prevSpriteASTNode,
  nextSpriteASTNode,
  eventHandler,
  transitions,
  transitionElements,
  signal,
}) {
  if (signal?.aborted) {
    return;
  }

  const spriteElement = parent.children.find(
    (child) => child.label === prevSpriteASTNode.id,
  );

  const updateElement = () => {
    if (
      JSON.stringify(prevSpriteASTNode) !== JSON.stringify(nextSpriteASTNode)
    ) {
      if (prevSpriteASTNode.url !== nextSpriteASTNode.url) {
        const texture = nextSpriteASTNode.url
          ? Texture.from(nextSpriteASTNode.url)
          : Texture.EMPTY;
        spriteElement.texture = texture;
      }

      spriteElement.x = nextSpriteASTNode.x;
      spriteElement.y = nextSpriteASTNode.y;
      spriteElement.width = nextSpriteASTNode.width;
      spriteElement.height = nextSpriteASTNode.height;

      spriteElement.alpha = nextSpriteASTNode.alpha;
      spriteElement.zIndex = nextSpriteASTNode.zIndex;

      spriteElement.removeAllListeners("pointerover");
      spriteElement.removeAllListeners("pointerout");
      spriteElement.removeAllListeners("pointerdown");
      spriteElement.removeAllListeners("pointerupoutside");
      spriteElement.removeAllListeners("pointerup");

      const hoverEvents = nextSpriteASTNode?.hover;
      const clickEvents = nextSpriteASTNode?.click;

      if (eventHandler && hoverEvents) {
        const { cursor, soundSrc, actionPayload } = hoverEvents;
        spriteElement.eventMode = "static";

        const overListener = () => {
          if (actionPayload)
            eventHandler(`${spriteElement.label}-pointer-over`, {
              _event: {
                id: spriteElement.label,
              },
              ...actionPayload,
            });
          if (cursor) spriteElement.cursor = cursor;
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
            spriteElement.texture = hoverTexture;
          }
        };

        const outListener = () => {
          spriteElement.cursor = "auto";
          spriteElement.texture = nextSpriteASTNode.url
            ? Texture.from(nextSpriteASTNode.url)
            : Texture.EMPTY;
        };

        spriteElement.on("pointerover", overListener);
        spriteElement.on("pointerout", outListener);
      }

      if (eventHandler && clickEvents) {
        const { soundSrc, actionPayload } = clickEvents;
        spriteElement.eventMode = "static";

        const clickListener = () => {
          // Apply click texture during pointerdown
          if (clickEvents?.src) {
            const clickTexture = clickEvents.src
              ? Texture.from(clickEvents.src)
              : Texture.EMPTY;
            spriteElement.texture = clickTexture;
          }
        };

        const releaseListener = () => {
          // Restore original texture on pointerup
          spriteElement.texture = nextSpriteASTNode.url
            ? Texture.from(nextSpriteASTNode.url)
            : Texture.EMPTY;

          // Trigger event and sound on pointerup
          if (actionPayload)
            eventHandler(`${spriteElement.label}-click`, {
              _event: {
                id: spriteElement.label,
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
          spriteElement.texture = nextSpriteASTNode.url
            ? Texture.from(nextSpriteASTNode.url)
            : Texture.EMPTY;
        };

        spriteElement.on("pointerdown", clickListener);
        spriteElement.on("pointerup", releaseListener);
        spriteElement.on("pointerupoutside", outListener);
      }
    }
  };
  signal.addEventListener("abort", () => {
    updateElement();
  });

  if (spriteElement) {
    if (transitions && transitions.length > 0) {
      await transitionElements(prevSpriteASTNode.id, {
        app,
        sprite: spriteElement,
        transitions,
        signal,
      });
    }
    updateElement();
  }
}
