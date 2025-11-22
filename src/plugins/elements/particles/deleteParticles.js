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