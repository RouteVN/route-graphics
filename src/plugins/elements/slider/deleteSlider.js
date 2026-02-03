/**
 * Delete slider element
 * @param {import("../elementPlugin").DeleteElementOptions} params
 */
export const deleteSlider = ({
  parent,
  element,
  animations,
  animationBus,
  completionTracker,
}) => {
  const sliderContainer = parent.getChildByLabel(element.id);

  if (!sliderContainer) return;

  const relevantAnimations =
    animations?.filter((a) => a.targetId === element.id) || [];

  if (relevantAnimations.length === 0) {
    // No animation, destroy immediately
    sliderContainer.destroy({ children: true });
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
        element: sliderContainer,
        properties: animation.properties,
        targetState: null, // null signals destroy on cancel
        onComplete: () => {
          completionTracker.complete(stateVersion);
          if (sliderContainer && !sliderContainer.destroyed) {
            sliderContainer.destroy({ children: true });
          }
        },
      },
    });
  }
};
