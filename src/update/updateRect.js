/**
 * Update function for Rectangle elements
 * @typedef {import('../types.js').RectASTNode} RectASTNode
 * @typedef {import('pixi.js').Container} Container
 */

/**
 * @param {Object} params
 * @param {import('../types.js').Application} params.app
 * @param {Container} params.parent
 * @param {RectASTNode} params.prevRectASTNode
 * @param {RectASTNode} params.nextRectASTNode
 * @param {Object[]} params.transitions
 * @param {Function} eventHandler
 * @param {AbortSignal} params.signal
 * @param {Function} params.transitionElements
 */
export async function updateRect({
  app,
  parent,
  prevRectASTNode,
  nextRectASTNode,
  eventHandler,
  transitions,
  transitionElements,
  signal,
}) {
  if (signal?.aborted) {
    return;
  }

  const rectElement = parent.children.find(
    (child) => child.label === prevRectASTNode.id,
  );

  const updateElement = () => {
    if (JSON.stringify(prevRectASTNode) !== JSON.stringify(nextRectASTNode)) {
      rectElement.clear();

      rectElement
        .rect(0, 0, nextRectASTNode.width, nextRectASTNode.height)
        .fill(nextRectASTNode.fill);
      rectElement.x = nextRectASTNode.x;
      rectElement.y = nextRectASTNode.y;

      if (nextRectASTNode.border) {
        rectElement.stroke({
          color: nextRectASTNode.border.color,
          alpha: nextRectASTNode.border.alpha,
          width: nextRectASTNode.border.width,
        });
      }

      rectElement.zIndex = nextRectASTNode.zIndex;

      rectElement.removeAllListeners("pointerover");
      rectElement.removeAllListeners("pointerout");
      rectElement.removeAllListeners("pointerup");

      const hoverEvents = nextRectASTNode?.hover;
      const clickEvents = nextRectASTNode?.click;

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

        rectElement._hoverCleanupCb = () => {
          rectElement.off("pointerover", overListener);
          rectElement.off("pointerout", outListener);
        };
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

        rectElement._clickCleanupCb = () => {
          rectElement.off("pointerup", clickListener);
        };
      }
    }
  };

  signal.addEventListener("abort", () => {
    updateElement();
  });

  if (rectElement) {
    if (transitions && transitions.length > 0) {
      await transitionElements(prevRectASTNode.id, {
        app,
        sprite: rectElement,
        transitions,
        signal,
      });
    }
    updateElement();
  }
}
