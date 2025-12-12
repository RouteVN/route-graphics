import animateElements from "../../../util/animateElements.js";

export const deleteParticles = async ({
  app,
  parent,
  element,
  animationPlugins,
  animations,
  signal,
}) => {
  if (signal?.aborted) {
    return;
  }

  const particleElement = parent.getChildByLabel(element.id);

  if (particleElement) {
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

    signal.addEventListener("abort", () => {
      deleteElement();
    });

    if (animations && animations.length > 0) {
      await animateElements(element.id, animationPlugins, {
        app,
        element: particleElement,
        animations,
        signal,
      });
    }
    deleteElement();
  }
};
