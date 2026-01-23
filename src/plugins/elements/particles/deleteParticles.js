export const deleteParticles = ({
  app,
  parent,
  element,
  animationBus,
  animations,
  completionTracker,
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
    const stateVersion = completionTracker.getVersion();
    completionTracker.track(stateVersion);

    animationBus.dispatch({
      type: "START",
      payload: {
        id: animation.id,
        element: particleElement,
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
