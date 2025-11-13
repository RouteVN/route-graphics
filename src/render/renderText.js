import { Text } from "pixi.js";
import applyTextStyle from "../util/applyTextStyle.js";

/**
 * @typedef {import('../types.js').Container} Container
 * @typedef {import('../types.js').TextASTNode} TextASTNode
 */

/**
 *
 * @param {Object} params
 * @param {import('../types.js').Application} params.app
 * @param {Container} params.parent
 * @param {TextASTNode} params.textASTNode
 * @param {Object[]} params.transitions
 * @param {AbortSignal} params.signal
 * @param {Function} params.transitionElements
 */
export const renderText = async ({
  app,
  parent,
  textASTNode,
  transitions,
  eventHandler,
  transitionElements,
  signal,
}) => {
  if (signal?.aborted) {
    return;
  }

  const text = new Text({
    label: textASTNode.id,
  });
  const drawText = () => {
    text.text = textASTNode.content;
    applyTextStyle(text, textASTNode.textStyle);
    text.alpha = textASTNode.alpha;
    text.x = textASTNode.x;
    text.y = textASTNode.y;
  };

  signal.addEventListener("abort", () => {
    drawText();
  });
  drawText();
  const hoverEvents = textASTNode?.hover;
  const clickEvents = textASTNode?.click;

  if (eventHandler && hoverEvents) {
    const { cursor, soundSrc, actionPayload } = hoverEvents;
    text.eventMode = "static";

    const overListener = () => {
      if (actionPayload)
        eventHandler(`${text.label}-pointer-over`, {
          _event: {
            id: text.label,
          },
          ...actionPayload,
        });
      if (cursor) text.cursor = cursor;
      if (soundSrc)
        app.audioStage.add({
          id: `hover-${Date.now()}`,
          url: soundSrc,
          loop: false,
        });
      if (hoverEvents?.textStyle) applyTextStyle(text, hoverEvents.textStyle);
    };

    const outListener = () => {
      text.cursor = "auto";
      applyTextStyle(text, textASTNode.textStyle);
    };

    text.on("pointerover", overListener);
    text.on("pointerout", outListener);
  }

  if (eventHandler && clickEvents) {
    const { soundSrc, actionPayload } = clickEvents;
    text.eventMode = "static";

    const clickListener = () => {
      // Apply click style during pointerdown
      if (clickEvents?.textStyle) applyTextStyle(text, clickEvents.textStyle);
    };

    const releaseListener = () => {
      // Restore original style on pointerup
      applyTextStyle(text, textASTNode.textStyle);

      // Trigger event and sound on pointerup
      if (actionPayload)
        eventHandler(`${text.label}-click`, {
          _event: {
            id: text.label,
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
      // Restore original style on pointerout
      applyTextStyle(text, textASTNode.textStyle);
    };

    text.on("pointerdown", clickListener);
    text.on("pointerup", releaseListener);
    text.on("pointerupoutside", outListener);
  }

  parent.addChild(text);

  if (transitions && transitions.length > 0) {
    await transitionElements(textASTNode.id, {
      app,
      sprite: text,
      transitions,
      signal,
    });
  }
};
