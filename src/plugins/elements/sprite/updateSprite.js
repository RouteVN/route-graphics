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
      const texture = nextElement.src
        ? Texture.from(nextElement.src)
        : Texture.EMPTY;
      spriteElement.texture = texture;

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

      let events = {
        isHovering: false,
        isPressed: false,
      };

      const updateTexture = ({ isHovering, isPressed }) => {
        console.log("IsPressed: ", isPressed);
        console.log("IsHovering: ", isHovering);
        if (isPressed && clickEvents?.src) {
          const clickTexture = Texture.from(clickEvents.src);
          spriteElement.texture = clickTexture;
        } else if (isHovering && hoverEvents?.src) {
          const hoverTexture = Texture.from(hoverEvents.src);
          spriteElement.texture = hoverTexture;
        } else {
          spriteElement.texture = texture;
        }
      };

      if (hoverEvents) {
        const { cursor, soundSrc, actionPayload } = hoverEvents;
        spriteElement.eventMode = "static";

        const overListener = () => {
          events.isHovering = true;
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
          updateTexture(events);
        };

        const outListener = () => {
          events.isHovering = false;
          spriteElement.cursor = "auto";
          updateTexture(events);
        };

        spriteElement.on("pointerover", overListener);
        spriteElement.on("pointerout", outListener);
      }

      if (clickEvents) {
        const { soundSrc, actionPayload } = clickEvents;
        spriteElement.eventMode = "static";

        const clickListener = () => {
          events.isPressed = true;
          updateTexture(events);
        };

        const releaseListener = () => {
          events.isPressed = false;
          updateTexture(events);

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
          events.isPressed = false;
          updateTexture(events);
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
