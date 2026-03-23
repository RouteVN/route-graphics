export const createRenderContext = ({
  suppressAnimations = false,
  deferredMountEffects = [],
} = {}) => ({
  suppressAnimations,
  deferredMountEffects,
});

export const queueDeferredMountEffect = (renderContext, effect) => {
  if (typeof effect !== "function") {
    return;
  }

  if (!renderContext?.suppressAnimations) {
    effect();
    return;
  }

  renderContext.deferredMountEffects.push(effect);
};

export const flushDeferredMountEffects = (renderContext) => {
  if (!renderContext?.deferredMountEffects?.length) {
    return;
  }

  const effects = renderContext.deferredMountEffects.splice(0);

  for (const effect of effects) {
    effect();
  }
};
