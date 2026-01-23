/**
 * Delete rectangle element (synchronous)
 * @param {import("../elementPlugin.js").DeleteElementOptions} params
 */
export const deleteRect = ({
  app,
  parent,
  element,
  animations,
  animationBus,
  eventHandler,
}) => {
  const rect = parent.getChildByLabel(element.id);

  if (!rect) return;

  const relevantAnimations =
    animations?.filter((a) => a.targetId === element.id) || [];

  if (relevantAnimations.length === 0) {
    // No animation, destroy immediately
    rect.destroy();
    return;
  }

  // Dispatch delete animations to the bus
  for (const animation of relevantAnimations) {
    animationBus.dispatch({
      type: "START",
      payload: {
        id: animation.id,
        element: rect,
        properties: animation.properties,
        targetState: null, // null signals destroy on cancel
        onComplete: () => {
          if (animation.complete) {
            eventHandler?.("complete", {
              _event: { id: animation.id, targetId: element.id },
              ...animation.complete.actionPayload,
            });
          }
          if (rect && !rect.destroyed) {
            rect.destroy();
          }
        },
      },
    });
  }
};
