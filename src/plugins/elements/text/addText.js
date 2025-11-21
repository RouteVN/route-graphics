import { Text } from "pixi.js";
import applyTextStyle from "../../../util/applyTextStyle.js";
import animateElements from "../../../util/animateElements.js";

/**
 * Add text element to the stage
 * @param {import("../elementPlugin.js").AddElementOptions} params
 */
export const addText = async ({
  app,
  parent,
  element: textASTNode,
  animations,
  eventHandler,
  animationPlugins,
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

  if (hoverEvents) {
    const { cursor, soundSrc, actionPayload } = hoverEvents;
    text.eventMode = "static";

    const overListener = () => {
      if (actionPayload && eventHandler)
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
      if (hoverEvents?.textStyle) applyTextStyle(text, hoverEvents.textStyle, textASTNode.textStyle);
    };

    const outListener = () => {
      text.cursor = "auto";
      applyTextStyle(text, textASTNode.textStyle);
    };

    text.on("pointerover", overListener);
    text.on("pointerout", outListener);
  }

  if (clickEvents) {
    const { soundSrc, actionPayload } = clickEvents;
    text.eventMode = "static";

    const clickListener = () => {
      // Apply click style during pointerdown
      if (clickEvents?.textStyle) applyTextStyle(text, clickEvents.textStyle, textASTNode.textStyle);
    };

    const releaseListener = () => {
      // Restore original style on pointerup
      applyTextStyle(text, textASTNode.textStyle);

      // Trigger event and sound on pointerup
      if (actionPayload && eventHandler)
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

  if (animations && animations.length > 0) {
    await animateElements(textASTNode.id, animationPlugins, {
      app,
      element: text,
      animations,
      signal,
    });
  }
};
