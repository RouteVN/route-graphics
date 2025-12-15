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
  const dragEvent = element?.drag;

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

  const keyboardEvents = element?.keyboard;
  if (keyboardEvents && keyboardEvents.length > 0) {
    rect.eventMode = "static";
    let hasFocus = false;

    const keyHandlers = keyboardEvents.map(({ key, actionPayload }) => {
      const handleKey = (e) => {
        if (e.key === key && hasFocus) {
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
      keyHandlers.forEach(handler => handler(e));
    };

    const handlePointerDown = () => {
      hasFocus = true;
    };

    const handlePointerDownOutside = () => {
      hasFocus = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    rect.on('pointerdown', handlePointerDown);
    app.stage.on('pointerdown', handlePointerDownOutside);

    const cleanupKeyboard = () => {
      window.removeEventListener('keydown', handleKeyDown);
      rect.off('pointerdown', handlePointerDown);
      app.stage.off('pointerdown', handlePointerDownOutside);
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
