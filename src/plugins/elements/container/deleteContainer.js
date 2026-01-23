/**
 * Delete container element (synchronous)
 * @param {import("../elementPlugin").DeleteElementOptions} params
 */
export const deleteContainer = ({
  app,
  parent,
  element,
  animationBus,
  animations,
  eventHandler,
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
    animationBus.dispatch({
      type: "START",
      payload: {
        id: animation.id,
        element: containerElement,
        properties: animation.properties,
        targetState: null, // null signals destroy on cancel
        onComplete: () => {
          if (animation.complete) {
            eventHandler?.("complete", {
              _event: { id: animation.id, targetId: element.id },
              ...animation.complete.actionPayload,
            });
          }
          deleteElement();
        },
      },
    });
  }
};
