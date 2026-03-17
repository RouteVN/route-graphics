import { Text } from "pixi.js";
import applyTextStyle from "../../../util/applyTextStyle.js";
import { dispatchLiveAnimations } from "../../animations/planAnimations.js";
import {
  applyInteractiveTextStyle,
  syncTextAnchorRatios,
} from "./textLayout.js";
import { isPrimaryPointerEvent } from "../util/isPrimaryPointerEvent.js";

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
  syncTextAnchorRatios(text, textComputedNode);
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
      applyInteractiveTextStyle(
        text,
        textComputedNode.textStyle,
        rightClickEvents.textStyle,
      );
    } else if (isPressed && clickEvents?.textStyle) {
      applyInteractiveTextStyle(
        text,
        textComputedNode.textStyle,
        clickEvents.textStyle,
      );
    } else if (isHovering && hoverEvents?.textStyle) {
      applyInteractiveTextStyle(
        text,
        textComputedNode.textStyle,
        hoverEvents.textStyle,
      );
    } else {
      applyInteractiveTextStyle(text, textComputedNode.textStyle);
    }
  };

  if (hoverEvents) {
    const { cursor, soundSrc, payload } = hoverEvents;
    text.eventMode = "static";

    const overListener = () => {
      events.isHovering = true;
      if (payload && eventHandler)
        eventHandler(`hover`, {
          _event: {
            id: text.label,
          },
          ...payload,
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
    const { soundSrc, soundVolume, payload } = clickEvents;
    text.eventMode = "static";

    const clickListener = (event) => {
      if (!isPrimaryPointerEvent(event)) {
        return;
      }

      events.isPressed = true;
      updateTextStyle(events);
    };

    const releaseListener = (event) => {
      if (!isPrimaryPointerEvent(event)) {
        return;
      }

      events.isPressed = false;
      updateTextStyle(events);

      if (payload && eventHandler)
        eventHandler(`click`, {
          _event: {
            id: text.label,
          },
          ...payload,
        });
      if (soundSrc)
        app.audioStage.add({
          id: `click-${Date.now()}`,
          url: soundSrc,
          loop: false,
          volume: (soundVolume ?? 1000) / 1000,
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
    const { soundSrc, payload } = rightClickEvents;
    text.eventMode = "static";

    const rightPressListener = () => {
      events.isRightPressed = true;
      updateTextStyle(events);
    };

    const rightReleaseListener = () => {
      events.isRightPressed = false;
      updateTextStyle(events);
    };

    const rightClickListener = () => {
      events.isRightPressed = false;
      updateTextStyle(events);

      if (payload && eventHandler) {
        eventHandler(`rightClick`, {
          _event: {
            id: text.label,
          },
          ...payload,
        });
      }
      if (soundSrc) {
        app.audioStage.add({
          id: `rightClick-${Date.now()}`,
          url: soundSrc,
          loop: false,
        });
      }
    };

    const rightOutListener = () => {
      events.isRightPressed = false;
      updateTextStyle(events);
    };

    text.on("rightdown", rightPressListener);
    text.on("rightup", rightReleaseListener);
    text.on("rightclick", rightClickListener);
    text.on("rightupoutside", rightOutListener);
  }

  parent.addChild(text);

  dispatchLiveAnimations({
    animations,
    targetId: textComputedNode.id,
    animationBus,
    completionTracker,
    element: text,
    targetState: {
      x: textComputedNode.x,
      y: textComputedNode.y,
      alpha: textComputedNode.alpha,
    },
  });
};
