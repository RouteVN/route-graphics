import { Graphics } from "pixi.js";

/**
 * @typedef {import('../types.js').Container} Container
 * @typedef {import('../types.js').RectASTNode} RectASTNode
 */

/**
 *
 * @param {Object} params
 * @param {import('../types.js').Application} params.app
 * @param {Container} params.parent
 * @param {RectASTNode} params.rectASTNode
 * @param {Object[]} params.transitions
 * @param {Function} params.transitionElements
 * @param {AbortSignal} params.signal
 */
export const renderRect = async ({
  app,
  parent,
  rectASTNode,
  transitions,
  eventHandler,
  transitionElements,
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
  } = rectASTNode;

  const rect = new Graphics();
  rect.label = id;

  const drawRect = () => {
    rect.clear();
    rect.rect(0, 0, width, height).fill(fill);
    rect.x = x;
    rect.y = y;
    rect.alpha = alpha;

    if (border) {
      rect.stroke({
        color: border.color,
        alpha: border.alpha,
        width: border.width,
      });
    }
  };

  signal.addEventListener("abort", () => {
    drawRect();
  });
  drawRect();

  const hoverEvents = rectASTNode?.hover;
  const clickEvents = rectASTNode?.click;

  if (eventHandler && hoverEvents) {
    const { cursor, soundSrc, actionPayload } = hoverEvents;
    rect.eventMode = "static";

    const overListener = () => {
      if (actionPayload)
        eventHandler(`${rect.label}-pointer-over`, {
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

  if (eventHandler && clickEvents) {
    const { soundSrc, actionPayload } = clickEvents;
    rect.eventMode = "static";

    const releaseListener = () => {
      // Trigger event and sound on pointerup
      if (actionPayload)
        eventHandler(`${rect.label}-click`, {
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

  parent.addChild(rect);

  if (transitions && transitions.length > 0) {
    await transitionElements(id, { app, sprite: rect, transitions, signal });
  }
};
