import { Texture } from "pixi.js";
import animateElements from "../../../util/animateElements.js";

/**
 * Update sprite element
 * @param {import("../elementPlugin.js").UpdateElementOptions} params
 */
export const updateSprite = async ({
  app,
  parent,
  prevElement,
  nextElement,
  animations,
  animationPlugins,
  eventHandler,
  signal,
}) => {
  const spriteElement = parent.children.find(
    (child) => child.label === prevElement.id,
  );

  let isAnimationDone = true;

  const updateElement = () => {
    if (JSON.stringify(prevElement) !== JSON.stringify(nextElement)) {
      if (prevElement.src !== nextElement.src) {
        const texture = nextElement.src
          ? Texture.from(nextElement.src)
          : Texture.EMPTY;
        spriteElement.texture = texture;
      }

      spriteElement.x = Math.round(nextElement.x);
      spriteElement.y = Math.round(nextElement.y);
      spriteElement.width = Math.round(nextElement.width);
      spriteElement.height = Math.round(nextElement.height);
      spriteElement.alpha = nextElement.alpha;

      spriteElement.removeAllListeners("pointerover");
      spriteElement.removeAllListeners("pointerout");
      spriteElement.removeAllListeners("pointerdown");
      spriteElement.removeAllListeners("pointerupoutside");
      spriteElement.removeAllListeners("pointerup");

      const hoverEvents = nextElement?.hover;
      const clickEvents = nextElement?.click;

      if (hoverEvents) {
        const { cursor, soundSrc, actionPayload } = hoverEvents;
        spriteElement.eventMode = "static";

        const overListener = () => {
          if (actionPayload && eventHandler)
            eventHandler(`hover`, {
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
          spriteElement.texture = nextElement.src
            ? Texture.from(nextElement.src)
            : Texture.EMPTY;
        };

        spriteElement.on("pointerover", overListener);
        spriteElement.on("pointerout", outListener);
      }

      if (clickEvents) {
        const { soundSrc, actionPayload } = clickEvents;
        spriteElement.eventMode = "static";

        const clickListener = () => {
          if (clickEvents?.src) {
            const clickTexture = clickEvents.src
              ? Texture.from(clickEvents.src)
              : Texture.EMPTY;
            spriteElement.texture = clickTexture;
          }
        };

        const releaseListener = () => {
          spriteElement.texture = nextElement.src
            ? Texture.from(nextElement.src)
            : Texture.EMPTY;

          if (actionPayload && eventHandler)
            eventHandler(`click`, {
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
          spriteElement.texture = nextElement.src
            ? Texture.from(nextElement.src)
            : Texture.EMPTY;
        };

        spriteElement.on("pointerdown", clickListener);
        spriteElement.on("pointerup", releaseListener);
        spriteElement.on("pointerupoutside", outListener);
      }
    }
  };

  const abortHandler = async () => {
    if (!isAnimationDone) {
      updateElement();
    }
  };

  signal.addEventListener("abort", abortHandler);

  if (spriteElement) {
    if (animations && animations.length > 0) {
      isAnimationDone = false;
      await animateElements(prevElement.id, animationPlugins, {
        app,
        element: spriteElement,
        animations,
        signal,
      });
      isAnimationDone = true;
    }
    updateElement();
    signal.removeEventListener("abort", abortHandler);
  }
};
