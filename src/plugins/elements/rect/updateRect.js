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
  if (signal?.aborted) {
    return;
  }

  const rectElement = parent.children.find(
    (child) => child.label === prevElement.id,
  );

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

      const hoverEvents = nextElement?.hover;
      const clickEvents = nextElement?.click;

      if (eventHandler && hoverEvents) {
        const { cursor, soundSrc, actionPayload } = hoverEvents;
        rectElement.eventMode = "static";

        const overListener = () => {
          if (actionPayload)
            eventHandler(`${rectElement.label}-pointer-over`, {
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

      if (eventHandler && clickEvents) {
        const { soundSrc, actionPayload } = clickEvents;
        rectElement.eventMode = "static";

        const clickListener = () => {
          if (actionPayload)
            eventHandler(`${rectElement.label}-click`, {
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
    }
  };

  signal.addEventListener("abort", () => {
    updateElement();
  });

  if (rectElement) {
    if (animations && animations.length > 0) {
      await animateElements(prevElement.id, animationPlugins, {
        app,
        element: rectElement,
        animations: animations,
        signal,
      });
    }
    updateElement();
  }
};
