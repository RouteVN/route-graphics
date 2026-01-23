export const deleteParticles = ({
  app,
  parent,
  element,
  animationBus,
  animations,
  eventHandler,
}) => {
  const particleElement = parent.getChildByLabel(element.id);

  if (!particleElement) return;

  const deleteElement = () => {
    if (particleElement && !particleElement.destroyed) {
      // Clean up emitter if present
      if (particleElement.emitter) {
        particleElement.emitter.destroy();
      }

      // Remove ticker callback if present
      if (particleElement.tickerCallback) {
        app.ticker.remove(particleElement.tickerCallback);
      }

      // Remove custom ticker handler if present (used in testing mode)
      if (particleElement.customTickerHandler) {
        window.removeEventListener(
          "snapShotKeyFrame",
          particleElement.customTickerHandler,
        );
      }

      particleElement.destroy({ children: true });
    }
  };

  const relevantAnimations =
    animations?.filter((a) => a.targetId === element.id) || [];

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
        element: particleElement,
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
