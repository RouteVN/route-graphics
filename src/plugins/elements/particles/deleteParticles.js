import { dispatchLiveAnimations } from "../../animations/liveAnimationUtils.js";

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

  const dispatched = dispatchLiveAnimations({
    animations,
    targetId: element.id,
    operation: "exit",
    animationBus,
    completionTracker,
    element: particleElement,
    targetState: null,
    onComplete: deleteElement,
  });

  if (!dispatched) {
    deleteElement();
  }
};
