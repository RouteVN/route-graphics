import { Text } from "pixi.js";
import applyTextStyle from "../../../util/applyTextStyle.js";

/**
 * Add text element to the stage (synchronous)
 * @param {import("../elementPlugin.js").AddElementOptions} params
 */
export const addText = ({
  app,
  parent,
  element: textComputedNode,
  animations,
  eventHandler,
  animationBus,
  completionTracker,
  zIndex,
}) => {
  const text = new Text({
    label: textComputedNode.id,
  });
  text.zIndex = zIndex;

  // Apply initial state
  text.text = textComputedNode.content;
  applyTextStyle(text, textComputedNode.textStyle);
  text.alpha = textComputedNode.alpha;
  text.x = textComputedNode.x;
  text.y = textComputedNode.y;

  const hoverEvents = textComputedNode?.hover;
  const clickEvents = textComputedNode?.click;
  const rightClickEvents = textComputedNode?.rightClick;

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
      applyTextStyle(text, textComputedNode.textStyle);
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
    const { soundSrc, soundVolume, actionPayload } = clickEvents;
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
          volume: soundVolume ?? 1.0,
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
    animations?.filter((a) => a.targetId === textComputedNode.id) || [];

  for (const animation of relevantAnimations) {
    const stateVersion = completionTracker.getVersion();
    completionTracker.track(stateVersion);

    animationBus.dispatch({
      type: "START",
      payload: {
        id: animation.id,
        element: text,
        properties: animation.properties,
        targetState: {
          x: textComputedNode.x,
          y: textComputedNode.y,
          alpha: textComputedNode.alpha,
        },
        onComplete: () => {
          completionTracker.complete(stateVersion);
        },
      },
    });
  }
};
