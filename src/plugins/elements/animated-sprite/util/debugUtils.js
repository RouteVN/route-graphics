/**
 * Setup debug mode for animated sprite
 * @param {import("pixi.js").AnimatedSprite} animatedSprite
 * @param {string} elementId
 * @param {boolean} isDebug
 */
export const setupDebugMode = (animatedSprite, elementId, isDebug) => {
  if (!isDebug) return;

  const handler = (event) => {
    if (
      event?.detail?.elementId === elementId &&
      typeof event?.detail?.frameIndex === "number"
    ) {
      animatedSprite.gotoAndStop(event?.detail?.frameIndex);
    }
  };

  window.addEventListener("snapShotKeyFrame", handler);
  animatedSprite._snapShotKeyFrameHandler = handler;
};

/**
 * Cleanup debug mode for animated sprite
 * @param {import("pixi.js").AnimatedSprite} animatedSprite
 */
export const cleanupDebugMode = (animatedSprite) => {
  if (animatedSprite._snapShotKeyFrameHandler) {
    window.removeEventListener(
      "snapShotKeyFrame",
      animatedSprite._snapShotKeyFrameHandler,
    );
    delete animatedSprite._snapShotKeyFrameHandler;
  }
};
