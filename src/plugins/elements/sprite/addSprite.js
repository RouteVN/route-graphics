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
  const { id, x, y, width, height, src, alpha } = element;
  const texture = src ? Texture.from(src) : Texture.EMPTY;
  const sprite = new Sprite(texture);
  sprite.label = id;

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
  const rightClickEvents = element?.rightClick;

  let events = {
    isHovering: false,
    isPressed: false,
    isRightPressed: false,
  };

  const updateTexture = ({ isHovering, isPressed, isRightPressed }) => {
    if (isRightPressed && rightClickEvents?.src) {
      const rightClickTexture = Texture.from(rightClickEvents.src);
      sprite.texture = rightClickTexture;
    } else if (isPressed && clickEvents?.src) {
      const clickTexture = Texture.from(clickEvents.src);
      sprite.texture = clickTexture;
    } else if (isHovering && hoverEvents?.src) {
      const hoverTexture = Texture.from(hoverEvents.src);
      sprite.texture = hoverTexture;
    } else {
      sprite.texture = texture;
    }
  };

  if (hoverEvents) {
    const { cursor, soundSrc, actionPayload } = hoverEvents;
    sprite.eventMode = "static";

    const overListener = () => {
      events.isHovering = true;
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
      updateTexture(events);
    };

    const outListener = () => {
      events.isHovering = false;
      sprite.cursor = "auto";
      updateTexture(events);
    };

    sprite.on("pointerover", overListener);
    sprite.on("pointerout", outListener);
  }

  if (clickEvents) {
    const { soundSrc, actionPayload } = clickEvents;
    sprite.eventMode = "static";

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
      events.isPressed = false;
      updateTexture(events);
    };

    sprite.on("pointerdown", clickListener);
    sprite.on("pointerup", releaseListener);
    sprite.on("pointerupoutside", outListener);
  }

  if (rightClickEvents) {
    const { soundSrc, actionPayload } = rightClickEvents;
    sprite.eventMode = "static";

    const rightClickListener = () => {
      events.isRightPressed = true;
      updateTexture(events);
    };

    const rightReleaseListener = () => {
      events.isRightPressed = false;
      updateTexture(events);

      if (actionPayload && eventHandler) {
        eventHandler(`rightclick`, {
          _event: {
            id: sprite.label,
          },
          ...actionPayload,
        });
      }
      if (soundSrc) {
        app.audioStage.add({
          id: `rightclick-${Date.now()}`,
          url: soundSrc,
          loop: false,
        });
      }
    };

    const rightOutListener = () => {
      events.isRightPressed = false;
      updateTexture(events);
    };

    sprite.on("rightdown", rightClickListener);
    sprite.on("rightup", rightReleaseListener);
    sprite.on("rightupoutside", rightOutListener);
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
