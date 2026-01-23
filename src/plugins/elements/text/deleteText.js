/**
 * Delete text element (synchronous)
 * @param {import("../elementPlugin").DeleteElementOptions} params
 */
export const deleteText = ({
  parent,
  element,
  animations,
  animationBus,
  completionTracker,
}) => {
  const text = parent.getChildByLabel(element.id);

  if (!text) return;

  const relevantAnimations =
    animations?.filter((a) => a.targetId === element.id) || [];

  if (relevantAnimations.length === 0) {
    // No animation, destroy immediately
    text.destroy();
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
        element: text,
        properties: animation.properties,
        targetState: null, // null signals destroy on cancel
        onComplete: () => {
          completionTracker.complete(stateVersion);
          if (text && !text.destroyed) {
            text.destroy();
          }
        },
      },
    });
  }
};
