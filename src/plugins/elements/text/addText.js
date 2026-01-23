import { Text } from "pixi.js";
import applyTextStyle from "../../../util/applyTextStyle.js";

/**
 * Add text element to the stage (synchronous)
 * @param {import("../elementPlugin.js").AddElementOptions} params
 */
export const addText = ({
  app,
  parent,
  element: textASTNode,
  animations,
  eventHandler,
  animationBus,
  zIndex,
}) => {
  const text = new Text({
    label: textASTNode.id,
  });
  text.zIndex = zIndex;

  // Apply initial state
  text.text = textASTNode.content;
  applyTextStyle(text, textASTNode.textStyle);
  text.alpha = textASTNode.alpha;
  text.x = textASTNode.x;
  text.y = textASTNode.y;

  const hoverEvents = textASTNode?.hover;
  const clickEvents = textASTNode?.click;
  const rightClickEvents = textASTNode?.rightClick;

  let events = {
    isHovering: false,
    isPressed: false,
    isRightPressed: false,
  };

  const updateTextStyle = ({ isHovering, isPressed, isRightPressed }) => {
    if (isRightPressed && rightClickEvents?.textStyle) {
      applyTextStyle(text, rightClickEvents.textStyle);
    } else if (isPressed && clickEvents?.textStyle) {
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

  if (rightClickEvents) {
    const { soundSrc, actionPayload } = rightClickEvents;
    text.eventMode = "static";

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
            id: text.label,
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

    text.on("rightdown", rightClickListener);
    text.on("rightup", rightReleaseListener);
    text.on("rightupoutside", rightOutListener);
  }

  parent.addChild(text);

  // Dispatch animations to the bus
  const relevantAnimations =
    animations?.filter((a) => a.targetId === textASTNode.id) || [];

  for (const animation of relevantAnimations) {
    animationBus.dispatch({
      type: "START",
      payload: {
        id: animation.id,
        element: text,
        properties: animation.properties,
        targetState: { x: textASTNode.x, y: textASTNode.y, alpha: textASTNode.alpha },
        onComplete: animation.complete
          ? () => {
              eventHandler?.("complete", {
                _event: { id: animation.id, targetId: textASTNode.id },
                ...animation.complete.actionPayload,
              });
            }
          : undefined,
      },
    });
  }
};
