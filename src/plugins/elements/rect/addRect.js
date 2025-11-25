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
  if (signal?.aborted) {
    return;
  }

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

  signal.addEventListener("abort", () => {
    drawRect();
  });
  drawRect();

  const hoverEvents = element?.hover;
  const clickEvents = element?.click;

  if (hoverEvents) {
    const { cursor, soundSrc, actionPayload } = hoverEvents;
    rect.eventMode = "static";

    const overListener = () => {
      if (actionPayload && eventHandler)
        eventHandler(`hover`, {
          _event: {
            id: rect.label,
          },
          payload: { ...actionPayload },
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
          payload: { ...actionPayload },
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

  parent.addChild(rect);

  if (animations && animations.length > 0) {
    await animateElements(id, animationPlugins, {
      app,
      element: rect,
      animations,
      signal,
    });
  }
};
