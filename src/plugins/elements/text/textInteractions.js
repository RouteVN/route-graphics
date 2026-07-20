import { normalizeVolume } from "../../../util/normalizeVolume.js";
import { isPrimaryPointerEvent } from "../util/isPrimaryPointerEvent.js";
import {
  clearInheritedHoverTarget,
  clearInheritedPressTarget,
  clearInheritedRightPressTarget,
  createHoverStateController,
  createPressStateController,
  createRightPressStateController,
} from "../util/hoverInheritance.js";
import { setupScrollInteraction } from "../util/setupScrollInteraction.js";
import { isElementInteractionEnabled } from "../../../util/isElementInteractionEnabled.js";

export const clearTextInteractions = (displayObject) => {
  displayObject._cleanupScrollInteraction?.();
  displayObject.removeAllListeners("pointerover");
  displayObject.removeAllListeners("pointerout");
  displayObject.removeAllListeners("pointerdown");
  displayObject.removeAllListeners("pointerupoutside");
  displayObject.removeAllListeners("pointerup");
  displayObject.removeAllListeners("rightdown");
  displayObject.removeAllListeners("rightclick");
  displayObject.removeAllListeners("rightup");
  displayObject.removeAllListeners("rightupoutside");
  displayObject.removeAllListeners("wheel");
  clearInheritedHoverTarget(displayObject);
  clearInheritedPressTarget(displayObject);
  clearInheritedRightPressTarget(displayObject);
  displayObject.cursor = "auto";
  displayObject.eventMode = "auto";
};

export const bindTextInteractions = ({
  app,
  displayObject,
  textComputedNode,
  eventHandler,
  applyStyle,
}) => {
  if (
    !isElementInteractionEnabled({
      app,
      element: textComputedNode,
    })
  ) {
    displayObject.eventMode = "none";
    applyStyle();
    return;
  }

  const hoverEvents = textComputedNode?.hover;
  const clickEvents = textComputedNode?.click;
  const rightClickEvents = textComputedNode?.rightClick;
  const scrollUpEvent = textComputedNode?.scrollUp;
  const scrollDownEvent = textComputedNode?.scrollDown;

  let hoverController = null;
  let pressController = null;
  let rightPressController = null;

  const updateTextStyle = () => {
    const isHovering = hoverController?.isHovering() ?? false;
    const isPressed = pressController?.isPressed() ?? false;
    const isRightPressed = rightPressController?.isPressed() ?? false;

    if (isRightPressed && rightClickEvents?.textStyle) {
      applyStyle(rightClickEvents.textStyle);
    } else if (isPressed && clickEvents?.textStyle) {
      applyStyle(clickEvents.textStyle);
    } else if (isHovering && hoverEvents?.textStyle) {
      applyStyle(hoverEvents.textStyle);
    } else {
      applyStyle();
    }
  };

  if (hoverEvents) {
    const { cursor, soundSrc, soundVolume, payload } = hoverEvents;

    displayObject.eventMode = "static";
    hoverController = createHoverStateController({
      displayObject,
      onHoverChange: updateTextStyle,
    });

    const overListener = () => {
      hoverController.setDirectHover(true);
      if (payload && eventHandler)
        eventHandler(`hover`, {
          _event: {
            id: displayObject.label,
          },
          ...payload,
        });
      if (cursor) displayObject.cursor = cursor;
      if (soundSrc)
        app.audioStage.add({
          id: `hover-${Date.now()}`,
          url: soundSrc,
          loop: false,
          volume: normalizeVolume(soundVolume),
        });
    };

    const outListener = () => {
      hoverController.setDirectHover(false);
      displayObject.cursor = "auto";
    };

    displayObject.on("pointerover", overListener);
    displayObject.on("pointerout", outListener);
  }

  if (clickEvents) {
    const { soundSrc, soundVolume, payload } = clickEvents;

    displayObject.eventMode = "static";
    pressController = createPressStateController({
      displayObject,
      onPressChange: updateTextStyle,
    });

    const clickListener = (event) => {
      if (!isPrimaryPointerEvent(event)) {
        return;
      }

      pressController.setDirectPress(true);
    };

    const releaseListener = (event) => {
      if (!isPrimaryPointerEvent(event)) {
        return;
      }

      pressController.setDirectPress(false);

      if (payload && eventHandler)
        eventHandler(`click`, {
          _event: {
            id: displayObject.label,
          },
          ...payload,
        });
      if (soundSrc)
        app.audioStage.add({
          id: `click-${Date.now()}`,
          url: soundSrc,
          loop: false,
          volume: normalizeVolume(soundVolume),
        });
    };

    const outListener = () => {
      pressController.setDirectPress(false);
    };

    displayObject.on("pointerdown", clickListener);
    displayObject.on("pointerup", releaseListener);
    displayObject.on("pointerupoutside", outListener);
  }

  if (rightClickEvents) {
    const { soundSrc, payload } = rightClickEvents;

    displayObject.eventMode = "static";
    rightPressController = createRightPressStateController({
      displayObject,
      onPressChange: updateTextStyle,
    });

    const rightPressListener = () => {
      rightPressController.setDirectPress(true);
    };

    const rightReleaseListener = () => {
      rightPressController.setDirectPress(false);
    };

    const rightClickListener = () => {
      rightPressController.setDirectPress(false);

      if (payload && eventHandler) {
        eventHandler(`rightClick`, {
          _event: {
            id: displayObject.label,
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
      rightPressController.setDirectPress(false);
    };

    displayObject.on("rightdown", rightPressListener);
    displayObject.on("rightup", rightReleaseListener);
    displayObject.on("rightclick", rightClickListener);
    displayObject.on("rightupoutside", rightOutListener);
  }

  if (scrollUpEvent || scrollDownEvent) {
    setupScrollInteraction({
      canvas: app.canvas,
      displayObject,
      scrollUpEvent,
      scrollDownEvent,
      eventHandler,
    });
  }
};
