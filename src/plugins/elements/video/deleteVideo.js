import animateElements from "../../../util/animateElements.js";

/**
 * Delete video element
 * @param {import("../elementPlugin.js").DeleteElementOptions} params
 */
export const deleteVideo = async ({
  app,
  parent,
  element,
  animations,
  animationPlugins,
  signal,
}) => {
  const videoElement = parent.children.find(
    (child) => child.label === element.id,
  );

  if (videoElement) {
    let isAnimationDone = true;

    const deleteElement = () => {
      const audioElement = app.audioStage.getById(element.id);
      if (audioElement) {
        app.audioStage.stop(element.id);
      }

      if (videoElement && !videoElement.destroyed) {
        parent.removeChild(videoElement);
        videoElement.destroy();
      }
    };

    const abortHandler = async () => {
      if (!isAnimationDone) {
        deleteElement();
      }
    };

    signal.addEventListener("abort", abortHandler);

    if (animations && animations.length > 0) {
      isAnimationDone = false;
      await animateElements(element.id, animationPlugins, {
        app,
        element: videoElement,
        animations,
        signal,
      });
      isAnimationDone = true;
    }

    deleteElement();
    signal.removeEventListener("abort", abortHandler);
  }
};