/**
 * Delete sprite element (synchronous)
 * @param {import("../elementPlugin.js").DeleteElementOptions} params
 */
export const deleteSprite = ({
  app,
  parent,
  element,
  animations,
  animationBus,
  eventHandler,
}) => {
  const spriteElement = parent.children.find(
    (child) => child.label === element.id,
  );

  if (!spriteElement) return;

  const relevantAnimations =
    animations?.filter((a) => a.targetId === element.id) || [];

  if (relevantAnimations.length === 0) {
    // No animation, destroy immediately
    spriteElement.destroy();
    return;
  }

  // Dispatch delete animations to the bus
  for (const animation of relevantAnimations) {
    animationBus.dispatch({
      type: "START",
      payload: {
        id: animation.id,
        element: spriteElement,
        properties: animation.properties,
        targetState: null, // null signals destroy on cancel
        onComplete: () => {
          if (animation.complete) {
            eventHandler?.("complete", {
              _event: { id: animation.id, targetId: element.id },
              ...animation.complete.actionPayload,
            });
          }
          if (spriteElement && !spriteElement.destroyed) {
            spriteElement.destroy();
          }
        },
      },
    });
  }
};
