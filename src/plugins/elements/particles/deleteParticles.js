import { dispatchLiveAnimations } from "../../animations/planAnimations.js";
import { cleanupParticlesRuntime } from "./particleRuntime.js";

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
      cleanupParticlesRuntime({ app, particleElement });
      particleElement.destroy({ children: true });
    }
  };

  const dispatched = dispatchLiveAnimations({
    animations,
    targetId: element.id,
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
