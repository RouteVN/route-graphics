/**
 * Delete sprite element (synchronous)
 * @param {import("../elementPlugin.js").DeleteElementOptions} params
 */
export const deleteSprite = ({
  parent,
  element,
  animations,
  animationBus,
  completionTracker,
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
    const stateVersion = completionTracker.getVersion();
    completionTracker.track(stateVersion);

    animationBus.dispatch({
      type: "START",
      payload: {
        id: animation.id,
        element: spriteElement,
        properties: animation.properties,
        targetState: null, // null signals destroy on cancel
        onComplete: () => {
          completionTracker.complete(stateVersion);
          if (spriteElement && !spriteElement.destroyed) {
            spriteElement.destroy();
          }
        },
      },
    });
  }
};
