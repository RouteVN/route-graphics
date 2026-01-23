import { Texture } from "pixi.js";

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
    if (JSON.stringify(prevElement) !== JSON.stringify(nextElement)) {
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
      spriteElement.removeAllListeners("rightup");
      spriteElement.removeAllListeners("rightupoutside");

      const hoverEvents = nextElement?.hover;
      const clickEvents = nextElement?.click;
      const rightClickEvents = nextElement?.rightClick;

      let events = {
        isHovering: false,
        isPressed: false,
        isRightPressed: false,
      };

      const updateTexture = ({ isHovering, isPressed, isRightPressed }) => {
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
        const { soundSrc, soundVolume, actionPayload } = clickEvents;
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
              volume: soundVolume ?? 1.0,
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

      if (rightClickEvents) {
        const { soundSrc, actionPayload } = rightClickEvents;
        spriteElement.eventMode = "static";

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
                id: spriteElement.label,
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

        spriteElement.on("rightdown", rightClickListener);
        spriteElement.on("rightup", rightReleaseListener);
        spriteElement.on("rightupoutside", rightOutListener);
      }
    }
  };

  // Dispatch animations to the bus
  const relevantAnimations =
    animations?.filter((a) => a.targetId === prevElement.id) || [];

  if (relevantAnimations.length > 0) {
    for (const animation of relevantAnimations) {
      const stateVersion = completionTracker.getVersion();
      completionTracker.track(stateVersion);

      animationBus.dispatch({
        type: "START",
        payload: {
          id: animation.id,
          element: spriteElement,
          properties: animation.properties,
          targetState: { x, y, width, height, alpha },
          onComplete: () => {
            completionTracker.complete(stateVersion);
            updateElement();
          },
        },
      });
    }
  } else {
    // No animations, update immediately
    updateElement();
  }
};
