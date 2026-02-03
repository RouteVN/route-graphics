/**
 * Delete container element (synchronous)
 * @param {import("../elementPlugin").DeleteElementOptions} params
 */
export const deleteContainer = ({
  parent,
  element,
  animationBus,
  animations,
  completionTracker,
}) => {
  const containerElement = parent.getChildByLabel(element.id);

  if (!containerElement) return;

  const relevantAnimations =
    animations?.filter((a) => a.targetId === element.id) || [];

  const deleteElement = () => {
    if (containerElement && !containerElement.destroyed) {
      parent.removeChild(containerElement);
      containerElement.destroy({
        children: true,
        texture: true,
        baseTexture: true,
      });
    }
  };

  if (relevantAnimations.length === 0) {
    // No animation, destroy immediately
    deleteElement();
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
        element: containerElement,
        properties: animation.properties,
        targetState: null, // null signals destroy on cancel
        onComplete: () => {
          completionTracker.complete(stateVersion);
          deleteElement();
        },
      },
    });
  }
};
