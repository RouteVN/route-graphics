/**
 * Delete video element
 * @param {import("../elementPlugin.js").DeleteElementOptions} params
 */
export const deleteVideo = ({
  app,
  parent,
  element,
  animations,
  animationBus,
  completionTracker,
}) => {
  const videoElement = parent.children.find(
    (child) => child.label === element.id,
  );

  if (!videoElement) return;

  const relevantAnimations =
    animations?.filter((a) => a.targetId === element.id) || [];

  if (relevantAnimations.length === 0) {
    // No animation, destroy immediately
    const video = videoElement.texture.source.resource;
    if (video) {
      if (videoElement._videoEndedListener) {
        video.removeEventListener("ended", videoElement._videoEndedListener);
      }
      video.pause();
    }
    parent.removeChild(videoElement);
    videoElement.destroy();
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
        element: videoElement,
        properties: animation.properties,
        targetState: null, // null signals destroy on cancel
        onComplete: () => {
          completionTracker.complete(stateVersion);
          if (videoElement && !videoElement.destroyed) {
            const video = videoElement.texture.source.resource;
            if (video) {
              if (videoElement._videoEndedListener) {
                video.removeEventListener(
                  "ended",
                  videoElement._videoEndedListener,
                );
              }
              video.pause();
            }
            parent.removeChild(videoElement);
            videoElement.destroy();
          }
        },
      },
    });
  }
};
