import animateElements from "../../../util/animateElements.js";
import applyTextStyle from "../../../util/applyTextStyle.js";

/**
 *
 * @param {import("../elementPlugin.js").UpdateElementOptions} params
 * @returns
 */
export const updateText = async ({
  app,
  parent,
  prevElement: prevTextASTNode,
  nextElement: nextTextASTNode,
  eventHandler,
  animations,
  animationPlugins,
  signal,
}) => {
  const textElement = parent.children.find(
    (child) => child.label === prevTextASTNode.id,
  );

  let isAnimationDone = true;

  const updateElement = () => {
    if (JSON.stringify(prevTextASTNode) !== JSON.stringify(nextTextASTNode)) {
      textElement.text = nextTextASTNode.content;
      applyTextStyle(textElement, nextTextASTNode.textStyle);

      textElement.x = nextTextASTNode.x;
      textElement.y = nextTextASTNode.y;
      textElement.alpha = nextTextASTNode.alpha;

      textElement.removeAllListeners("pointerover");
      textElement.removeAllListeners("pointerout");
      textElement.removeAllListeners("pointerdown");
      textElement.removeAllListeners("pointerupoutside");
      textElement.removeAllListeners("pointerup");

      const hoverEvents = nextTextASTNode?.hover;
      const clickEvents = nextTextASTNode?.click;

      let events = {
        isHovering: false,
        isPressed: false,
      }

      const updateTextStyle = ({isHovering, isPressed}) => {
        console.log("IsPressed: ",isPressed);
        console.log("IsHovering: ",isHovering);
        if (isPressed && clickEvents?.textStyle) {
          applyTextStyle(textElement, clickEvents.textStyle);
        } else if (isHovering && hoverEvents?.textStyle) {
          applyTextStyle(textElement, hoverEvents.textStyle);
        } else {
          applyTextStyle(textElement, textASTNode.textStyle);
        }
      };

      if (hoverEvents) {
        const { cursor, soundSrc, actionPayload } = hoverEvents;
        textElement.eventMode = "static";

        const overListener = () => {
          events.isHovering = true;
          if (actionPayload && eventHandler)
            eventHandler(`hover`, {
              _event: {
                id: textElement.label,
              },
              ...actionPayload,
            });
          if (cursor) textElement.cursor = cursor;
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
          textElement.cursor = "auto";
          updateTextStyle(events);
        };

        textElement.on("pointerover", overListener);
        textElement.on("pointerout", outListener);
      }

      if (clickEvents) {
        const { soundSrc, actionPayload } = clickEvents;
        textElement.eventMode = "static";

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
                id: textElement.label,
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
          updateTextStyle();
        };

        textElement.on("pointerdown", clickListener);
        textElement.on("pointerup", releaseListener);
        textElement.on("pointerupoutside", outListener);
      }
    }
  };
  const abortHandler = async () => {
    if (!isAnimationDone) {
      updateElement();
    }
  };

  signal.addEventListener("abort", abortHandler);

  if (textElement) {
    if (animations && animations.length > 0) {
      isAnimationDone = false;
      await animateElements(nextTextASTNode.id, animationPlugins, {
        app,
        element: textElement,
        animations,
        signal,
      });
      isAnimationDone = true;
    }
    updateElement();
    signal.removeEventListener("abort", abortHandler);
  }
};
