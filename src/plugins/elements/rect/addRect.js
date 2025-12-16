import animateElements from "../../../util/animateElements.js";
import { Graphics } from "pixi.js";

/**
 * Add rectangle element to the stage
 * @param {import("../elementPlugin.js").AddElementOptions} params
 */
export const addRect = async ({
  app,
  parent,
  element,
  animations,
  animationPlugins,
  eventHandler,
  signal,
}) => {
  const {
    id,
    x,
    y,
    width,
    height,
    fill,
    border,
    originX,
    originY,
    rotation,
    alpha,
  } = element;

  const rect = new Graphics();
  rect.label = id;
  let isAnimationDone = true;

  const drawRect = () => {
    rect.clear();
    rect.rect(0, 0, Math.round(width), Math.round(height)).fill(fill);
    rect.x = Math.round(x);
    rect.y = Math.round(y);
    rect.alpha = alpha;

    if (border) {
      rect.stroke({
        color: border.color,
        alpha: border.alpha,
        width: Math.round(border.width),
      });
    }
  };

  const abortHandler = async () => {
    if (!isAnimationDone) {
      drawRect();
    }
  };

  signal.addEventListener("abort", abortHandler);
  drawRect();

  const hoverEvents = element?.hover;
  const clickEvents = element?.click;
  const rightClickEvents = element?.rightClick;
  const scrollEvents = element?.scroll;
  const dragEvent = element?.drag;
  const keyboardEvents = element?.keyboard;

  if (hoverEvents) {
    const { cursor, soundSrc, actionPayload } = hoverEvents;
    rect.eventMode = "static";

    const overListener = () => {
      if (actionPayload && eventHandler)
        eventHandler(`hover`, {
          _event: {
            id: rect.label,
          },
          ...actionPayload,
        });
      if (cursor) rect.cursor = cursor;
      if (soundSrc)
        app.audioStage.add({
          id: `hover-${Date.now()}`,
          url: soundSrc,
          loop: false,
        });
    };

    const outListener = () => {
      rect.cursor = "auto";
    };

    rect.on("pointerover", overListener);
    rect.on("pointerout", outListener);
  }

  if (clickEvents) {
    const { soundSrc, actionPayload } = clickEvents;
    rect.eventMode = "static";

    const releaseListener = () => {
      if (actionPayload && eventHandler)
        eventHandler(`click`, {
          _event: {
            id: rect.label,
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

    rect.on("pointerup", releaseListener);
  }

  if (rightClickEvents) {
    const { soundSrc, actionPayload } = rightClickEvents;
    rect.eventMode = "static";

    const rightClickListener = () => {
      if (actionPayload && eventHandler)
        eventHandler(`rightclick`, {
          _event: {
            id: rect.label,
          },
          ...actionPayload,
        });
      if (soundSrc)
        app.audioStage.add({
          id: `rightclick-${Date.now()}`,
          url: soundSrc,
          loop: false,
        });
    };

    rect.on("rightclick", rightClickListener);
  }

  if (scrollEvents) {
    rect.eventMode = "static";

    const wheelListener = (e) => {
      if (e.deltaY < 0 && scrollEvents.up) {
        const { actionPayload } = scrollEvents.up;

        if (actionPayload && eventHandler)
          eventHandler(`scrollup`, {
            _event: {
              id: rect.label,
            },
            ...actionPayload,
          });
      } else if (e.deltaY > 0 && scrollEvents.down) {
        const { actionPayload } = scrollEvents.down;

        if (actionPayload && eventHandler)
          eventHandler(`scrolldown`, {
            _event: {
              id: rect.label,
            },
            ...actionPayload,
          });
      }
    };

    rect.on("wheel", wheelListener);
  }

  if (dragEvent) {
    const { start, end, move } = dragEvent;
    rect.eventMode = "static";

    const downListener = () => {
      rect._isDragging = true;
      if (start && eventHandler) {
        eventHandler("drag-start", {
          _event: {
            id: rect.label,
          },
          ...(typeof start?.actionPayload === "object"
            ? start.actionPayload
            : {}),
        });
      }
    };

    const upListener = () => {
      rect._isDragging = false;
      if (end && eventHandler) {
        eventHandler("drag-end", {
          _event: {
            id: rect.label,
          },
          ...(typeof end?.actionPayload === "object" ? end.actionPayload : {}),
        });
      }
    };

    const moveListener = (e) => {
      if (move && eventHandler && rect._isDragging) {
        eventHandler("drag-move", {
          _event: {
            id: rect.label,
            x: e.global.x,
            y: e.global.y,
          },
          ...(typeof move?.actionPayload === "object"
            ? move.actionPayload
            : {}),
        });
      }
    };

    rect.on("pointerdown", downListener);
    rect.on("pointerup", upListener);
    rect.on("globalpointermove", moveListener);
    rect.on("pointerupoutside", upListener);
  }

  if (keyboardEvents && keyboardEvents?.length > 0) {
    rect.eventMode = "static";
    let hasFocus = false;

    const keyHandlers = keyboardEvents.map(({ key, actionPayload, soundSrc }) => {
      const handleKey = (e) => {
        const keyPressed = e.key.toLowerCase();
        const keysMatch = key.some(k => {
          if (k.includes('+')) {
            const parts = k.split('+');
            const modifier = parts[0].toLowerCase();
            const mainKey = parts[1].toLowerCase();

            if (modifier === 'ctrl' && e.ctrlKey && keyPressed === mainKey) {
              return true;
            }
            if (modifier === 'shift' && e.shiftKey && keyPressed === mainKey) {
              return true;
            }
            if (modifier === 'alt' && e.altKey && keyPressed === mainKey) {
              return true;
            }
            return false;
          }

          if (k === 'ctrl' && e.ctrlKey) {
            return true;
          }
          if (k === 'shift' && e.shiftKey) {
            return true;
          }
          if (k === 'alt' && e.altKey) {
            return true;
          }

          return k.toLowerCase() === keyPressed;
        });

        if (keysMatch && hasFocus) {
          e.stopPropagation();

          // Play sound if provided
          if (soundSrc) {
            app.audioStage.add({
              id: `keyboard-${Date.now()}`,
              url: soundSrc,
              loop: false,
            });
          }

          if (actionPayload && eventHandler) {
            eventHandler('keyboard', {
              _event: {
                id: rect.label,
                key: e.key,
              },
              ...actionPayload,
            });
          }
        }
      };

      return handleKey;
    });

    const handleKeyDown = (e) => {
      if(!hasFocus) return;
      keyHandlers.forEach(handler => handler(e));
    };

    const handlePointerDown = () => {
      hasFocus = true;
    };

    const handlePointerDownOutside = () => {
      hasFocus = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    rect.on('pointerover', handlePointerDown);
    rect.on('pointerout', handlePointerDownOutside);

    const cleanupKeyboard = () => {
      window.removeEventListener('keydown', handleKeyDown);
    };

    rect.cleanupKeyboard = cleanupKeyboard;
  }

  parent.addChild(rect);

  if (animations && animations.length > 0) {
    isAnimationDone = false;
    await animateElements(id, animationPlugins, {
      app,
      element: rect,
      animations,
      signal,
    });
  }
  isAnimationDone = true;

  signal.removeEventListener("abort", abortHandler);
};
