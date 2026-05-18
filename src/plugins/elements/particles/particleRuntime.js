const removeCustomTickerHandler = (particleElement) => {
  if (!particleElement.customTickerHandler) {
    return;
  }

  if (typeof window !== "undefined") {
    window.removeEventListener(
      "snapShotKeyFrame",
      particleElement.customTickerHandler,
    );
  }
  particleElement.customTickerHandler = undefined;
};

const removeTickerCallback = (app, particleElement) => {
  if (!particleElement.tickerCallback) {
    return;
  }

  app?.ticker?.remove?.(particleElement.tickerCallback);
  particleElement.tickerCallback = undefined;
};

export const cleanupParticlesRuntime = ({ app, particleElement } = {}) => {
  if (!particleElement) {
    return;
  }

  removeTickerCallback(app, particleElement);
  removeCustomTickerHandler(particleElement);

  if (particleElement.emitter) {
    particleElement.emitter.destroy();
    particleElement.emitter = undefined;
  }
};

export const cleanupParticlesInTree = ({ app, root } = {}) => {
  if (!root) {
    return;
  }

  const queue = [root];
  for (const node of queue) {
    if (!node) {
      continue;
    }

    if (node.emitter || node.tickerCallback || node.customTickerHandler) {
      cleanupParticlesRuntime({
        app,
        particleElement: node,
      });
    }

    if (Array.isArray(node.children) && node.children.length > 0) {
      queue.push(...node.children);
    }
  }
};
