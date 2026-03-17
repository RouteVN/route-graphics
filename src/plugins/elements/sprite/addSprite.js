import { Sprite, Texture } from "pixi.js";
import { dispatchLiveAnimations } from "../../animations/planAnimations.js";
import { isPrimaryPointerEvent } from "../util/isPrimaryPointerEvent.js";

/**
 * Add sprite element to the stage (synchronous)
 * @param {import("../elementPlugin.js").AddElementOptions} params
 */
export const addSprite = ({
  app,
  parent,
  element,
  animations,
  eventHandler,
  animationBus,
  completionTracker,
  zIndex,
}) => {
  const { id, x, y, width, height, src, alpha } = element;
  const texture = src ? Texture.from(src) : Texture.EMPTY;
  const sprite = new Sprite(texture);
  sprite.label = id;
  sprite.zIndex = zIndex;

  // Apply initial state
  sprite.x = Math.round(x);
  sprite.y = Math.round(y);
  sprite.width = Math.round(width);
  sprite.height = Math.round(height);
  sprite.alpha = alpha;

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
    const { cursor, soundSrc, payload } = hoverEvents;
    sprite.eventMode = "static";

    const overListener = () => {
      events.isHovering = true;
      if (payload && eventHandler)
        eventHandler(`hover`, {
          _event: {
            id: sprite.label,
          },
          ...payload,
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
    const { soundSrc, soundVolume, payload } = clickEvents;
    sprite.eventMode = "static";

    const clickListener = (event) => {
      if (!isPrimaryPointerEvent(event)) {
        return;
      }

      events.isPressed = true;
      updateTexture(events);
    };

    const releaseListener = (event) => {
      if (!isPrimaryPointerEvent(event)) {
        return;
      }

      events.isPressed = false;
      updateTexture(events);

      if (payload && eventHandler)
        eventHandler(`click`, {
          _event: {
            id: sprite.label,
          },
          ...payload,
        });
      if (soundSrc)
        app.audioStage.add({
          id: `click-${Date.now()}`,
          url: soundSrc,
          loop: false,
          volume: (soundVolume ?? 1000) / 1000,
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
    const { soundSrc, payload } = rightClickEvents;
    sprite.eventMode = "static";

    const rightPressListener = () => {
      events.isRightPressed = true;
      updateTexture(events);
    };

    const rightReleaseListener = () => {
      events.isRightPressed = false;
      updateTexture(events);
    };

    const rightClickListener = () => {
      events.isRightPressed = false;
      updateTexture(events);

      if (payload && eventHandler) {
        eventHandler(`rightClick`, {
          _event: {
            id: sprite.label,
          },
          ...payload,
        });
      }
      if (soundSrc) {
        app.audioStage.add({
          id: `rightClick-${Date.now()}`,
          url: soundSrc,
          loop: false,
        });
      }
    };

    const rightOutListener = () => {
      events.isRightPressed = false;
      updateTexture(events);
    };

    sprite.on("rightdown", rightPressListener);
    sprite.on("rightup", rightReleaseListener);
    sprite.on("rightclick", rightClickListener);
    sprite.on("rightupoutside", rightOutListener);
  }

  parent.addChild(sprite);

  dispatchLiveAnimations({
    animations,
    targetId: id,
    animationBus,
    completionTracker,
    element: sprite,
    targetState: { x, y, width, height, alpha },
  });
};
