import { dispatchLiveAnimations } from "../../animations/planAnimations.js";

/**
 * Delete video element
 * @param {import("../elementPlugin.js").DeleteElementOptions} params
 */
export const deleteVideo = ({
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

  const deleteElement = () => {
    if (videoElement && !videoElement.destroyed) {
      if (videoElement._playbackStateVersion !== null) {
        completionTracker.complete(videoElement._playbackStateVersion);
      }
      const video = videoElement.texture.source.resource;
      if (video) {
        if (videoElement._videoEndedListener) {
          video.removeEventListener("ended", videoElement._videoEndedListener);
        }
        video.pause();
      }
      parent.removeChild(videoElement);
      videoElement.destroy();
    }
  };

  const dispatched = dispatchLiveAnimations({
    animations,
    targetId: element.id,
    animationBus,
    completionTracker,
    element: videoElement,
    targetState: null,
    onComplete: deleteElement,
  });

  if (!dispatched) {
    deleteElement();
  }
};
