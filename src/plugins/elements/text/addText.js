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

  let events = {
    isHovering: false,
    isPressed: false,
  }

  const updateTextStyle = ({isHovering, isPressed}) => {
    if (isPressed && clickEvents?.textStyle) {
      applyTextStyle(text, clickEvents.textStyle);
    } else if (isHovering && hoverEvents?.textStyle) {
      applyTextStyle(text, hoverEvents.textStyle);
    } else {
      applyTextStyle(text, textASTNode.textStyle);
    }
  };

  if (hoverEvents) {
    const { cursor, soundSrc, actionPayload } = hoverEvents;
    text.eventMode = "static";

    const overListener = () => {
      events.isHovering = true;
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
      updateTextStyle(events);
    };

    const outListener = () => {
      events.isHovering = false;
      text.cursor = "auto";
      updateTextStyle(events);
    };

    text.on("pointerover", overListener);
    text.on("pointerout", outListener);
  }

  if (clickEvents) {
    const { soundSrc, actionPayload } = clickEvents;
    text.eventMode = "static";

    const clickListener = (e) => {
      events.isPressed = true;
      updateTextStyle(events);
    };

    const releaseListener = () => {
      events.isPressed = false;
      updateTextStyle(events);

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
      events.isPressed = false;
      updateTextStyle(events);
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
