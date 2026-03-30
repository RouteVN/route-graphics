import applyTextStyle from "../../../util/applyTextStyle.js";
import { isDeepEqual } from "../../../util/isDeepEqual.js";
import { dispatchLiveAnimations } from "../../animations/planAnimations.js";
import {
  getTextLayoutPosition,
  applyInteractiveTextStyle,
  positionTextInLayoutBox,
  syncTextAnchorRatios,
} from "./textLayout.js";
import { isPrimaryPointerEvent } from "../util/isPrimaryPointerEvent.js";
import {
  clearInheritedHoverTarget,
  createHoverStateController,
} from "../util/hoverInheritance.js";

/**
 * Update text element (synchronous)
 * @param {import("../elementPlugin.js").UpdateElementOptions} params
 */
export const updateText = ({
  app,
  parent,
  prevElement: prevTextComputedNode,
  nextElement: nextTextComputedNode,
  eventHandler,
  animations,
  animationBus,
  completionTracker,
  zIndex,
}) => {
  const textElement = parent.children.find(
    (child) => child.label === prevTextComputedNode.id,
  );

  if (!textElement) return;

  textElement.zIndex = zIndex;

  const { alpha } = nextTextComputedNode;

  const updateElement = () => {
    if (!isDeepEqual(prevTextComputedNode, nextTextComputedNode)) {
      textElement.text = nextTextComputedNode.content;
      applyTextStyle(textElement, nextTextComputedNode.textStyle);
      syncTextAnchorRatios(textElement, nextTextComputedNode);

      positionTextInLayoutBox(textElement, nextTextComputedNode);
      textElement.alpha = alpha;

      textElement.removeAllListeners("pointerover");
      textElement.removeAllListeners("pointerout");
      textElement.removeAllListeners("pointerdown");
      textElement.removeAllListeners("pointerupoutside");
      textElement.removeAllListeners("pointerup");
      textElement.removeAllListeners("rightdown");
      textElement.removeAllListeners("rightclick");
      textElement.removeAllListeners("rightup");
      textElement.removeAllListeners("rightupoutside");
      clearInheritedHoverTarget(textElement);

      const hoverEvents = nextTextComputedNode?.hover;
      const clickEvents = nextTextComputedNode?.click;
      const rightClickEvents = nextTextComputedNode?.rightClick;

      let events = {
        isPressed: false,
        isRightPressed: false,
      };

      let hoverController = null;

      const updateTextStyle = () => {
        const isHovering = hoverController?.isHovering() ?? false;
        const { isPressed, isRightPressed } = events;

        if (isRightPressed && rightClickEvents?.textStyle) {
          applyInteractiveTextStyle(
            textElement,
            nextTextComputedNode.textStyle,
            rightClickEvents.textStyle,
          );
        } else if (isPressed && clickEvents?.textStyle) {
          applyInteractiveTextStyle(
            textElement,
            nextTextComputedNode.textStyle,
            clickEvents.textStyle,
          );
        } else if (isHovering && hoverEvents?.textStyle) {
          applyInteractiveTextStyle(
            textElement,
            nextTextComputedNode.textStyle,
            hoverEvents.textStyle,
          );
        } else {
          applyInteractiveTextStyle(
            textElement,
            nextTextComputedNode.textStyle,
          );
        }
      };

      if (hoverEvents) {
        const { cursor, soundSrc, payload } = hoverEvents;
        textElement.eventMode = "static";
        hoverController = createHoverStateController({
          displayObject: textElement,
          onHoverChange: updateTextStyle,
        });

        const overListener = () => {
          hoverController.setDirectHover(true);
          if (payload && eventHandler)
            eventHandler(`hover`, {
              _event: {
                id: textElement.label,
              },
              ...payload,
            });
          if (cursor) textElement.cursor = cursor;
          if (soundSrc)
            app.audioStage.add({
              id: `hover-${Date.now()}`,
              url: soundSrc,
              loop: false,
            });
        };

        const outListener = () => {
          hoverController.setDirectHover(false);
          textElement.cursor = "auto";
        };

        textElement.on("pointerover", overListener);
        textElement.on("pointerout", outListener);
      }

      if (clickEvents) {
        const { soundSrc, soundVolume, payload } = clickEvents;
        textElement.eventMode = "static";

        const clickListener = (event) => {
          if (!isPrimaryPointerEvent(event)) {
            return;
          }

          events.isPressed = true;
          updateTextStyle();
        };

        const releaseListener = (event) => {
          if (!isPrimaryPointerEvent(event)) {
            return;
          }

          events.isPressed = false;
          updateTextStyle();

          if (payload && eventHandler)
            eventHandler(`click`, {
              _event: {
                id: textElement.label,
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
          updateTextStyle();
        };

        textElement.on("pointerdown", clickListener);
        textElement.on("pointerup", releaseListener);
        textElement.on("pointerupoutside", outListener);
      }

      if (rightClickEvents) {
        const { soundSrc, payload } = rightClickEvents;
        textElement.eventMode = "static";

        const rightPressListener = () => {
          events.isRightPressed = true;
          updateTextStyle();
        };

        const rightReleaseListener = () => {
          events.isRightPressed = false;
          updateTextStyle();
        };

        const rightClickListener = () => {
          events.isRightPressed = false;
          updateTextStyle();

          if (payload && eventHandler) {
            eventHandler(`rightClick`, {
              _event: {
                id: textElement.label,
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
          updateTextStyle();
        };

        textElement.on("rightdown", rightPressListener);
        textElement.on("rightup", rightReleaseListener);
        textElement.on("rightclick", rightClickListener);
        textElement.on("rightupoutside", rightOutListener);
      }
    }
  };

  const dispatched = dispatchLiveAnimations({
    animations,
    targetId: prevTextComputedNode.id,
    animationBus,
    completionTracker,
    element: textElement,
    targetState: {
      ...getTextLayoutPosition(nextTextComputedNode),
      alpha,
    },
    onComplete: () => {
      updateElement();
    },
  });

  if (!dispatched) {
    // No animations, update immediately
    updateElement();
  }
};
