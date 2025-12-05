import { Text, TextStyle } from "pixi.js";
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
  let isAnimationDone = true;

  const text = new Text({
    label: textASTNode.id,
  });
  text.zIndex = textASTNode.zIndex ?? 0;

  const drawText = () => {
    text.text = textASTNode.content;
    applyTextStyle(text, textASTNode.textStyle);
    text.alpha = textASTNode.alpha;
    text.x = textASTNode.x;
    text.y = textASTNode.y;
  };

  const abortHandler = async () => {
    if (!isAnimationDone) {
      drawText();
    }
  };

  signal.addEventListener("abort", abortHandler);
  drawText();
  const hoverEvents = textASTNode?.hover;
  const clickEvents = textASTNode?.click;

  if (hoverEvents) {
    const { cursor, soundSrc, actionPayload } = hoverEvents;
    text.eventMode = "static";

    const overListener = () => {
      if (actionPayload && eventHandler)
        eventHandler(`hover`, {
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
      if (hoverEvents?.textStyle)
        applyTextStyle(text, hoverEvents.textStyle, textASTNode.textStyle);
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
    let styleBeforeClick = textASTNode.textStyle;

    const clickListener = (e) => {
      if (clickEvents?.textStyle) {
        styleBeforeClick = e.target._style;
        applyTextStyle(text, clickEvents.textStyle);
      }
    };

    const releaseListener = () => {
      applyTextStyle(text, styleBeforeClick);

      if (actionPayload && eventHandler)
        eventHandler(`click`, {
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
      applyTextStyle(text, styleBeforeClick);
    };

    text.on("pointerdown", clickListener);
    text.on("pointerup", releaseListener);
    text.on("pointerupoutside", outListener);
  }

  parent.addChild(text);

  if (animations && animations.length > 0) {
    isAnimationDone = false;
    await animateElements(textASTNode.id, animationPlugins, {
      app,
      element: text,
      animations,
      signal,
    });
    isAnimationDone = true;
  }

  signal.removeEventListener("abort", abortHandler);
};
