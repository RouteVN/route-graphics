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

      if (hoverEvents) {
        const { cursor, soundSrc, actionPayload } = hoverEvents;
        textElement.eventMode = "static";

        const overListener = () => {
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
          if (hoverEvents?.textStyle)
            applyTextStyle(
              textElement,
              hoverEvents.textStyle,
              nextTextASTNode.textStyle,
            );
        };

        const outListener = () => {
          textElement.cursor = "auto";
          applyTextStyle(textElement, nextTextASTNode.textStyle);
        };

        textElement.on("pointerover", overListener);
        textElement.on("pointerout", outListener);
      }

      if (clickEvents) {
        const { soundSrc, actionPayload } = clickEvents;
        textElement.eventMode = "static";
        let styleBeforeClick = nextTextASTNode.textStyle

        const clickListener = (e) => {
          if (clickEvents?.textStyle){
            styleBeforeClick = e.target.style
            applyTextStyle(
              textElement,
              clickEvents.textStyle,
            );
          }
        };

        const releaseListener = () => {
          applyTextStyle(textElement, styleBeforeClick);

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
          applyTextStyle(textElement, styleBeforeClick);
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
