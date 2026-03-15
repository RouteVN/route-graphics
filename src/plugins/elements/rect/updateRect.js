import { isDeepEqual } from "../../../util/isDeepEqual.js";
import { dispatchLiveAnimations } from "../../animations/planAnimations.js";
import { setupScrollInteraction } from "./setupScrollInteraction.js";

/**
 * Update rectangle element (synchronous)
 * @param {import("../elementPlugin.js").UpdateElementOptions} params
 */
export const updateRect = ({
  app,
  parent,
  prevElement,
  nextElement,
  animations,
  animationBus,
  eventHandler,
  zIndex,
  completionTracker,
}) => {
  const rectElement = parent.children.find(
    (child) => child.label === prevElement.id,
  );

  if (!rectElement) return;

  rectElement.zIndex = zIndex;

  const { x, y, width, height, fill, border, alpha, scaleX, scaleY } =
    nextElement;

  const updateElement = () => {
    if (!isDeepEqual(prevElement, nextElement)) {
      rectElement._cleanupScrollInteraction?.();
      rectElement.clear();

      rectElement.rect(0, 0, Math.round(width), Math.round(height)).fill(fill);
      rectElement.x = Math.round(x);
      rectElement.y = Math.round(y);
      rectElement.alpha = alpha;
      rectElement.scale.x = scaleX ?? 1;
      rectElement.scale.y = scaleY ?? 1;

      if (border) {
        rectElement.stroke({
          color: border.color,
          alpha: border.alpha,
          width: Math.round(border.width),
        });
      }

      rectElement.removeAllListeners("pointerover");
      rectElement.removeAllListeners("pointerout");
      rectElement.removeAllListeners("pointerup");
      rectElement.removeAllListeners("rightclick");
      rectElement.removeAllListeners("wheel");
      rectElement.removeAllListeners("pointerdown");
      rectElement.removeAllListeners("globalpointermove");
      rectElement.removeAllListeners("pointerupoutside");

      const hoverEvents = nextElement?.hover;
      const clickEvents = nextElement?.click;
      const rightClickEvents = nextElement?.rightClick;
      const scrollUpEvent = nextElement?.scrollUp;
      const scrollDownEvent = nextElement?.scrollDown;
      const dragEvents = nextElement?.drag;

      if (hoverEvents) {
        const { cursor, soundSrc, payload } = hoverEvents;
        rectElement.eventMode = "static";

        const overListener = () => {
          if (payload && eventHandler)
            eventHandler(`hover`, {
              _event: {
                id: rectElement.label,
              },
              ...payload,
            });
          if (cursor) rectElement.cursor = cursor;
          if (soundSrc)
            app.audioStage.add({
              id: `hover-${Date.now()}`,
              url: soundSrc,
              loop: false,
            });
        };

        const outListener = () => {
          rectElement.cursor = "auto";
        };

        rectElement.on("pointerover", overListener);
        rectElement.on("pointerout", outListener);
      }

      if (clickEvents) {
        const { soundSrc, soundVolume, payload } = clickEvents;
        rectElement.eventMode = "static";

        const clickListener = () => {
          if (payload && eventHandler)
            eventHandler(`click`, {
              _event: {
                id: rectElement.label,
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

        rectElement.on("pointerup", clickListener);
      }

      if (rightClickEvents) {
        const { soundSrc, payload } = rightClickEvents;
        rectElement.eventMode = "static";

        const rightClickListener = () => {
          if (payload && eventHandler)
            eventHandler(`rightClick`, {
              _event: {
                id: rectElement.label,
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

        rectElement.on("rightclick", rightClickListener);
      }

      if (scrollUpEvent || scrollDownEvent) {
        setupScrollInteraction({
          canvas: app.canvas,
          rect: rectElement,
          width,
          height,
          scrollUpEvent,
          scrollDownEvent,
          eventHandler,
        });
      }

      if (dragEvents) {
        const { start, end, move } = dragEvents;
        rectElement.eventMode = "static";

        const downListener = () => {
          rectElement._isDragging = true;
          if (start && eventHandler) {
            eventHandler("dragStart", {
              _event: {
                id: rectElement.label,
              },
              ...(typeof start?.payload === "object" ? start.payload : {}),
            });
          }
        };

        const upListener = () => {
          rectElement._isDragging = false;
          if (end && eventHandler) {
            eventHandler("dragEnd", {
              _event: {
                id: rectElement.label,
              },
              ...(typeof end?.payload === "object" ? end.payload : {}),
            });
          }
        };

        const moveListener = (e) => {
          if (move && eventHandler && rectElement._isDragging) {
            eventHandler("dragMove", {
              _event: {
                id: rectElement.label,
                x: e.global.x,
                y: e.global.y,
              },
              ...(typeof move?.payload === "object" ? move.payload : {}),
            });
          }
        };

        rectElement.on("pointerdown", downListener);
        rectElement.on("pointerup", upListener);
        rectElement.on("globalpointermove", moveListener);
        rectElement.on("pointerupoutside", upListener);
      }
    }
  };

  const dispatched = dispatchLiveAnimations({
    animations,
    targetId: prevElement.id,
    animationBus,
    completionTracker,
    element: rectElement,
    targetState: { x, y, alpha, scaleX, scaleY },
    onComplete: () => {
      updateElement();
    },
  });

  if (!dispatched) {
    // No animations, update immediately
    updateElement();
  }
};
