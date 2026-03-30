import { Rectangle } from "pixi.js";
import { isPrimaryPointerEvent } from "../../util/isPrimaryPointerEvent.js";
import {
  getTreeInheritedHoverState,
  setTreeInheritedHover,
} from "../../util/hoverInheritance.js";

const setContainerHitArea = ({ container, element, enabled }) => {
  if (enabled) {
    container.hitArea = new Rectangle(0, 0, element.width, element.height);
    return;
  }

  container.hitArea = null;
};

export const bindContainerInteractions = ({
  app,
  container,
  element,
  eventHandler,
}) => {
  const wasInheritedHoverActive = getTreeInheritedHoverState(container);

  setTreeInheritedHover({ root: container, isHovered: false });
  container.removeAllListeners("pointerover");
  container.removeAllListeners("pointerout");
  container.removeAllListeners("pointerenter");
  container.removeAllListeners("pointerleave");
  container.removeAllListeners("pointerup");
  container.removeAllListeners("rightclick");
  container.cursor = "auto";

  if (!element.scroll) {
    container.eventMode = "auto";
    setContainerHitArea({ container, element, enabled: false });
  }

  const hoverEvents = element?.hover;
  const clickEvents = element?.click;
  const rightClickEvents = element?.rightClick;
  const hasPointerInteraction = Boolean(
    hoverEvents || clickEvents || rightClickEvents,
  );

  if (hasPointerInteraction) {
    container.eventMode = "static";

    if (!element.scroll) {
      setContainerHitArea({ container, element, enabled: true });
    }
  }

  if (hoverEvents) {
    const { cursor, soundSrc, payload, inheritToChildren } = hoverEvents;

    const overListener = () => {
      if (payload && eventHandler)
        eventHandler(`hover`, {
          _event: {
            id: container.label,
          },
          ...payload,
        });
      if (cursor) container.cursor = cursor;
      if (soundSrc)
        app.audioStage.add({
          id: `hover-${Date.now()}`,
          url: soundSrc,
          loop: false,
        });
    };

    const outListener = () => {
      container.cursor = "auto";
    };

    container.on("pointerover", overListener);
    container.on("pointerout", outListener);

    if (inheritToChildren) {
      const enterListener = () => {
        setTreeInheritedHover({ root: container, isHovered: true });
      };

      const leaveListener = () => {
        setTreeInheritedHover({ root: container, isHovered: false });
      };

      container.on("pointerenter", enterListener);
      container.on("pointerleave", leaveListener);
    }
  }

  if (clickEvents) {
    const { soundSrc, soundVolume, payload } = clickEvents;

    const releaseListener = (event) => {
      if (!isPrimaryPointerEvent(event)) {
        return;
      }

      if (payload && eventHandler)
        eventHandler(`click`, {
          _event: {
            id: container.label,
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

    container.on("pointerup", releaseListener);
  }

  if (rightClickEvents) {
    const { soundSrc, payload } = rightClickEvents;

    const rightClickListener = () => {
      if (payload && eventHandler)
        eventHandler(`rightClick`, {
          _event: {
            id: container.label,
          },
          ...payload,
        });
      if (soundSrc)
        app.audioStage.add({
          id: `rightClick-${Date.now()}`,
          url: soundSrc,
          loop: false,
        });
    };

    container.on("rightclick", rightClickListener);
  }

  if (hoverEvents?.inheritToChildren && wasInheritedHoverActive) {
    setTreeInheritedHover({ root: container, isHovered: true });
  }
};

export const reapplyContainerInheritedHover = ({ container }) => {
  if (getTreeInheritedHoverState(container)) {
    setTreeInheritedHover({ root: container, isHovered: true });
  }
};
