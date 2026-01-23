import applyTextStyle from "../../../util/applyTextStyle.js";

/**
 * Update text element (synchronous)
 * @param {import("../elementPlugin.js").UpdateElementOptions} params
 */
export const updateText = ({
  app,
  parent,
  prevElement: prevTextASTNode,
  nextElement: nextTextASTNode,
  eventHandler,
  animations,
  animationBus,
  zIndex,
}) => {
  const textElement = parent.children.find(
    (child) => child.label === prevTextASTNode.id,
  );

  if (!textElement) return;

  textElement.zIndex = zIndex;

  const { x, y, alpha } = nextTextASTNode;

  const updateElement = () => {
    if (JSON.stringify(prevTextASTNode) !== JSON.stringify(nextTextASTNode)) {
      textElement.text = nextTextASTNode.content;
      applyTextStyle(textElement, nextTextASTNode.textStyle);

      textElement.x = x;
      textElement.y = y;
      textElement.alpha = alpha;

      textElement.removeAllListeners("pointerover");
      textElement.removeAllListeners("pointerout");
      textElement.removeAllListeners("pointerdown");
      textElement.removeAllListeners("pointerupoutside");
      textElement.removeAllListeners("pointerup");
      textElement.removeAllListeners("rightdown");
      textElement.removeAllListeners("rightup");
      textElement.removeAllListeners("rightupoutside");

      const hoverEvents = nextTextASTNode?.hover;
      const clickEvents = nextTextASTNode?.click;
      const rightClickEvents = nextTextASTNode?.rightClick;

      let events = {
        isHovering: false,
        isPressed: false,
        isRightPressed: false,
      };

      const updateTextStyle = ({ isHovering, isPressed, isRightPressed }) => {
        if (isRightPressed && rightClickEvents?.textStyle) {
          applyTextStyle(textElement, rightClickEvents.textStyle);
        } else if (isPressed && clickEvents?.textStyle) {
          applyTextStyle(textElement, clickEvents.textStyle);
        } else if (isHovering && hoverEvents?.textStyle) {
          applyTextStyle(textElement, hoverEvents.textStyle);
        } else {
          applyTextStyle(textElement, nextTextASTNode.textStyle);
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

        const clickListener = () => {
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
          updateTextStyle(events);
        };

        textElement.on("pointerdown", clickListener);
        textElement.on("pointerup", releaseListener);
        textElement.on("pointerupoutside", outListener);
      }

      if (rightClickEvents) {
        const { soundSrc, actionPayload } = rightClickEvents;
        textElement.eventMode = "static";

        const rightClickListener = () => {
          events.isRightPressed = true;
          updateTextStyle(events);
        };

        const rightReleaseListener = () => {
          events.isRightPressed = false;
          updateTextStyle(events);

          if (actionPayload && eventHandler) {
            eventHandler(`rightclick`, {
              _event: {
                id: textElement.label,
              },
              ...actionPayload,
            });
          }
          if (soundSrc) {
            app.audioStage.add({
              id: `rightclick-${Date.now()}`,
              url: soundSrc,
              loop: false,
            });
          }
        };

        const rightOutListener = () => {
          events.isRightPressed = false;
          updateTextStyle(events);
        };

        textElement.on("rightdown", rightClickListener);
        textElement.on("rightup", rightReleaseListener);
        textElement.on("rightupoutside", rightOutListener);
      }
    }
  };

  // Dispatch animations to the bus
  const relevantAnimations =
    animations?.filter((a) => a.targetId === prevTextASTNode.id) || [];

  if (relevantAnimations.length > 0) {
    for (const animation of relevantAnimations) {
      animationBus.dispatch({
        type: "START",
        payload: {
          id: animation.id,
          element: textElement,
          properties: animation.properties,
          targetState: { x, y, alpha },
          onComplete: () => {
            if (animation.complete) {
              eventHandler?.("complete", {
                _event: { id: animation.id, targetId: prevTextASTNode.id },
                ...animation.complete.actionPayload,
              });
            }
            updateElement();
          },
        },
      });
    }
  } else {
    // No animations, update immediately
    updateElement();
  }
};
