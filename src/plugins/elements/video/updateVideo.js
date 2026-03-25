import { Texture } from "pixi.js";
import { isDeepEqual } from "../../../util/isDeepEqual.js";
import {
  clearVideoPlaybackTracking,
  syncVideoPlaybackTracking,
} from "./playbackTracking.js";
import { dispatchLiveAnimations } from "../../animations/planAnimations.js";

/**
 * Update video element
 * @param {import("../elementPlugin.js").UpdateElementOptions} params
 */
export const updateVideo = ({
  parent,
  prevElement,
  nextElement,
  animations,
  animationBus,
  eventHandler,
  completionTracker,
  zIndex,
}) => {
  const videoElement = parent.children.find(
    (child) => child.label === prevElement.id,
  );

  if (!videoElement) return;

  videoElement.zIndex = zIndex;

  const { x, y, width, height, alpha } = nextElement;

  const updateElement = () => {
    if (!isDeepEqual(prevElement, nextElement)) {
      videoElement.x = Math.round(x);
      videoElement.y = Math.round(y);
      videoElement.width = Math.round(width);
      videoElement.height = Math.round(height);
      videoElement.alpha = alpha ?? 1;

      let activeVideo = videoElement.texture.source.resource;

      if (prevElement.src !== nextElement.src) {
        const oldVideo = activeVideo;
        clearVideoPlaybackTracking({
          videoElement,
          video: oldVideo,
        });

        if (oldVideo) {
          oldVideo.pause();
        }

        const newTexture = Texture.from(nextElement.src);
        videoElement.texture = newTexture;
        activeVideo = newTexture.source.resource;

        activeVideo.muted = false;
        activeVideo.pause();
        activeVideo.currentTime = 0;
      }

      syncVideoPlaybackTracking({
        videoElement,
        video: activeVideo,
        loop: nextElement.loop,
        completionTracker,
      });

      activeVideo.volume = nextElement.volume / 1000;
      activeVideo.loop = nextElement.loop ?? false;

      if (prevElement.src !== nextElement.src) {
        activeVideo.play();
      }
    }
  };

  const dispatched = dispatchLiveAnimations({
    animations,
    targetId: prevElement.id,
    animationBus,
    completionTracker,
    element: videoElement,
    targetState: { x, y, width, height, alpha: alpha ?? 1 },
    onComplete: updateElement,
  });

  if (!dispatched) {
    // No animations, update immediately
    updateElement();
  }
};
