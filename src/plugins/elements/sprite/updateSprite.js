import { Texture } from "pixi.js";
import { isDeepEqual } from "../../../util/isDeepEqual.js";
import { dispatchLiveAnimations } from "../../animations/planAnimations.js";
import { isPrimaryPointerEvent } from "../util/isPrimaryPointerEvent.js";
import {
  clearInheritedHoverTarget,
  createHoverStateController,
} from "../util/hoverInheritance.js";

/**
 * Update sprite element (synchronous)
 * @param {import("../elementPlugin.js").UpdateElementOptions} params
 */
export const updateSprite = ({
  app,
  parent,
  prevElement,
  nextElement,
  animations,
  animationBus,
  completionTracker,
  eventHandler,
  zIndex,
}) => {
  const spriteElement = parent.children.find(
    (child) => child.label === prevElement.id,
  );

  if (!spriteElement) return;

  spriteElement.zIndex = zIndex;

  const { id, x, y, width, height, src, alpha } = nextElement;

  const updateElement = () => {
    if (!isDeepEqual(prevElement, nextElement)) {
      const texture = src ? Texture.from(src) : Texture.EMPTY;
      spriteElement.texture = texture;

      spriteElement.x = Math.round(x);
      spriteElement.y = Math.round(y);
      spriteElement.width = Math.round(width);
      spriteElement.height = Math.round(height);
      spriteElement.alpha = alpha;

      spriteElement.removeAllListeners("pointerover");
      spriteElement.removeAllListeners("pointerout");
      spriteElement.removeAllListeners("pointerdown");
      spriteElement.removeAllListeners("pointerupoutside");
      spriteElement.removeAllListeners("pointerup");
      spriteElement.removeAllListeners("rightdown");
      spriteElement.removeAllListeners("rightclick");
      spriteElement.removeAllListeners("rightup");
      spriteElement.removeAllListeners("rightupoutside");
      clearInheritedHoverTarget(spriteElement);

      const hoverEvents = nextElement?.hover;
      const clickEvents = nextElement?.click;
      const rightClickEvents = nextElement?.rightClick;

      let events = {
        isPressed: false,
        isRightPressed: false,
      };

      let hoverController = null;

      const updateTexture = () => {
        const isHovering = hoverController?.isHovering() ?? false;
        const { isPressed, isRightPressed } = events;

        if (isRightPressed && rightClickEvents?.src) {
          const rightClickTexture = Texture.from(rightClickEvents.src);
          spriteElement.texture = rightClickTexture;
        } else if (isPressed && clickEvents?.src) {
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
        const { cursor, soundSrc, payload } = hoverEvents;
        spriteElement.eventMode = "static";
        hoverController = createHoverStateController({
          displayObject: spriteElement,
          onHoverChange: updateTexture,
        });

        const overListener = () => {
          hoverController.setDirectHover(true);
          if (payload && eventHandler)
            eventHandler(`hover`, {
              _event: {
                id: spriteElement.label,
              },
              ...payload,
            });
          if (cursor) spriteElement.cursor = cursor;
          if (soundSrc)
            app.audioStage.add({
              id: `hover-${Date.now()}`,
              url: soundSrc,
              loop: false,
            });
        };

        const outListener = () => {
          hoverController.setDirectHover(false);
          spriteElement.cursor = "auto";
        };

        spriteElement.on("pointerover", overListener);
        spriteElement.on("pointerout", outListener);
      }

      if (clickEvents) {
        const { soundSrc, soundVolume, payload } = clickEvents;
        spriteElement.eventMode = "static";

        const clickListener = (event) => {
          if (!isPrimaryPointerEvent(event)) {
            return;
          }

          events.isPressed = true;
          updateTexture();
        };

        const releaseListener = (event) => {
          if (!isPrimaryPointerEvent(event)) {
            return;
          }

          events.isPressed = false;
          updateTexture();

          if (payload && eventHandler)
            eventHandler(`click`, {
              _event: {
                id: spriteElement.label,
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
          updateTexture();
        };

        spriteElement.on("pointerdown", clickListener);
        spriteElement.on("pointerup", releaseListener);
        spriteElement.on("pointerupoutside", outListener);
      }

      if (rightClickEvents) {
        const { soundSrc, payload } = rightClickEvents;
        spriteElement.eventMode = "static";

        const rightPressListener = () => {
          events.isRightPressed = true;
          updateTexture();
        };

        const rightReleaseListener = () => {
          events.isRightPressed = false;
          updateTexture();
        };

        const rightClickListener = () => {
          events.isRightPressed = false;
          updateTexture();

          if (payload && eventHandler) {
            eventHandler(`rightClick`, {
              _event: {
                id: spriteElement.label,
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
          updateTexture();
        };

        spriteElement.on("rightdown", rightPressListener);
        spriteElement.on("rightup", rightReleaseListener);
        spriteElement.on("rightclick", rightClickListener);
        spriteElement.on("rightupoutside", rightOutListener);
      }
    }
  };

  const dispatched = dispatchLiveAnimations({
    animations,
    targetId: prevElement.id,
    animationBus,
    completionTracker,
    element: spriteElement,
    targetState: { x, y, width, height, alpha },
    onComplete: () => {
      updateElement();
    },
  });

  if (!dispatched) {
    // No animations, update immediately
    updateElement();
  }
};
