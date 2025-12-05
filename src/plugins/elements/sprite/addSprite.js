import { Assets, Sprite, Texture } from "pixi.js";
import animateElements from "../../../util/animateElements.js";

/**
 * Add sprite element to the stage
 * @param {import("../elementPlugin.js").AddElementOptions} params
 */
export const addSprite = async ({
  app,
  parent,
  element,
  animations,
  eventHandler,
  animationPlugins,
  signal,
}) => {
  let isAnimationDone = true;
  const { id, x, y, width, height, src, alpha, zIndex } = element;
  const texture = src ? Texture.from(src) : Texture.EMPTY;
  const sprite = new Sprite(texture);
  sprite.label = id;
  sprite.zIndex = zIndex ?? 0;

  const drawSprite = () => {
    sprite.x = Math.round(x);
    sprite.y = Math.round(y);
    sprite.width = Math.round(width);
    sprite.height = Math.round(height);
    sprite.alpha = alpha;
  };

  const abortHandler = async () => {
    if (!isAnimationDone) {
      drawSprite();
    }
  };

  signal.addEventListener("abort", abortHandler);
  drawSprite();

  const hoverEvents = element?.hover;
  const clickEvents = element?.click;
  if (hoverEvents) {
    const { cursor, soundSrc, actionPayload } = hoverEvents;
    sprite.eventMode = "static";

    const overListener = () => {
      if (actionPayload && eventHandler)
        eventHandler(`hover`, {
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

  if (clickEvents) {
    const { soundSrc, actionPayload } = clickEvents;
    sprite.eventMode = "static";
    let spriteBeforeClick = texture;

    const clickListener = (e) => {
      if (clickEvents?.src) {
        spriteBeforeClick = { ...e.target._texture };
        const clickTexture = clickEvents.src
          ? Texture.from(clickEvents.src)
          : Texture.EMPTY;
        sprite.texture = clickTexture;
      }
    };

    const releaseListener = () => {
      sprite.texture = spriteBeforeClick;
      if (actionPayload && eventHandler)
        eventHandler(`click`, {
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
      sprite.texture = spriteBeforeClick;
    };

    sprite.on("pointerdown", clickListener);
    sprite.on("pointerup", releaseListener);
    sprite.on("pointerupoutside", outListener);
  }

  parent.addChild(sprite);

  if (animations && animations.length > 0) {
    isAnimationDone = false;
    await animateElements(id, animationPlugins, {
      app,
      element: sprite,
      animations,
      signal,
    });
    isAnimationDone = true;
  }

  signal.removeEventListener("abort", abortHandler);
};
