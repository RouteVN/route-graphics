import animateElements from "../../../util/animateElements.js";

/**
 * Update rectangle element
 * @param {import("../elementPlugin.js").UpdateElementOptions} params
 */
export const updateRect = async ({
  app,
  parent,
  prevElement,
  nextElement,
  animations,
  animationPlugins,
  eventHandler,
  signal,
}) => {
  const rectElement = parent.children.find(
    (child) => child.label === prevElement.id,
  );

  let isAnimationDone = true;

  const updateElement = () => {
    if (JSON.stringify(prevElement) !== JSON.stringify(nextElement)) {
      rectElement.clear();

      rectElement
        .rect(
          0,
          0,
          Math.round(nextElement.width),
          Math.round(nextElement.height),
        )
        .fill(nextElement.fill);
      rectElement.x = Math.round(nextElement.x);
      rectElement.y = Math.round(nextElement.y);
      rectElement.alpha = nextElement.alpha;

      if (nextElement.border) {
        rectElement.stroke({
          color: nextElement.border.color,
          alpha: nextElement.border.alpha,
          width: Math.round(nextElement.border.width),
        });
      }

      rectElement.removeAllListeners("pointerover");
      rectElement.removeAllListeners("pointerout");
      rectElement.removeAllListeners("pointerup");
      rectElement.removeAllListeners("pointerdown");
      rectElement.removeAllListeners("pointermove");

      const hoverEvents = nextElement?.hover;
      const clickEvents = nextElement?.click;
      const dragEvents = nextElement?.drag;

      if (hoverEvents) {
        const { cursor, soundSrc, actionPayload } = hoverEvents;
        rectElement.eventMode = "static";

        const overListener = () => {
          if (actionPayload && eventHandler)
            eventHandler(`hover`, {
              _event: {
                id: rectElement.label,
              },
              ...actionPayload,
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
        const { soundSrc, actionPayload } = clickEvents;
        rectElement.eventMode = "static";

        const clickListener = () => {
          if (actionPayload && eventHandler)
            eventHandler(`click`, {
              _event: {
                id: rectElement.label,
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

        rectElement.on("pointerup", clickListener);
      }

      if (dragEvents) {
        const { start, end, move } = dragEvents;
        let isDragging = false;
        rectElement.eventMode = "static";

        const downListener = (e) => {
          isDragging = true;
          if (start && eventHandler) {
            eventHandler("drag-start", {
              _event: {
                id: rectElement.label,
              },
              ...(start?.actionPayload ? start.actionPayload : {}),
            });
          }
        };

        const upListener = (e) => {
          isDragging = false;
          if (end && eventHandler) {
            eventHandler("drag-end", {
              _event: {
                id: rectElement.label,
              },
              ...(end?.actionPayload? end.actionPayload : {}),
            });
          }
        };

        const moveListener = (e) => {
          if (move && eventHandler && isDragging) {
            eventHandler("drag-move", {
              _event: {
                id: rectElement.label,
                x: e.global.x,
                y: e.global.y,
              },
              ...(move?.actionPayload? move.actionPayload : {}),
            });
          }
        };

        rectElement.on("pointerdown", downListener);
        rectElement.on("pointerup", upListener);
        rectElement.on("pointermove", moveListener);
      }
    }
  };

  const abortHandler = async () => {
    if (!isAnimationDone) {
      updateElement();
    }
  };

  signal.addEventListener("abort", abortHandler);

  if (rectElement) {
    if (animations && animations.length > 0) {
      isAnimationDone = false;
      await animateElements(prevElement.id, animationPlugins, {
        app,
        element: rectElement,
        animations: animations,
        signal,
      });
      isAnimationDone = true;
    }
    updateElement();
    signal.removeEventListener("abort", abortHandler);
  }
};
