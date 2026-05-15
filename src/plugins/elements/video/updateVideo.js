import { Texture } from "pixi.js";
import { isDeepEqual } from "../../../util/isDeepEqual.js";
import {
  clearVideoPlaybackTracking,
  syncVideoPlaybackTracking,
} from "./playbackTracking.js";
import {
  dispatchLiveAnimations,
  getLiveAnimations,
} from "../../animations/planAnimations.js";
import { normalizeVolume } from "../../../util/normalizeVolume.js";
import {
  getBlurTargetState,
  hasBlurUpdateAnimation,
  syncBlurEffect,
} from "../util/blurEffect.js";

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
  const shouldForceBlur = hasBlurUpdateAnimation(animations, prevElement.id);
  if (shouldForceBlur) {
    syncBlurEffect(videoElement, prevElement.blur, { force: true });
  }

  let currentSrc = prevElement.src;
  let didSyncResourceBeforeAnimation = false;
  const liveAnimations = getLiveAnimations(animations, prevElement.id);
  const hasLiveAnimation = liveAnimations.length > 0;
  const hasLiveAnimationTween = (property) =>
    liveAnimations.some((animation) =>
      Object.prototype.hasOwnProperty.call(animation.tween ?? {}, property),
    );

  const syncVideoResource = () => {
    let activeVideo = videoElement.texture.source.resource;
    const srcChanged = currentSrc !== nextElement.src;

    if (srcChanged) {
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
      currentSrc = nextElement.src;
    }

    syncVideoPlaybackTracking({
      videoElement,
      video: activeVideo,
      loop: nextElement.loop,
      completionTracker,
    });

    activeVideo.volume = normalizeVolume(nextElement.volume);
    activeVideo.loop = nextElement.loop ?? false;

    if (srcChanged) {
      activeVideo.play();
    }
  };

  const updateElement = () => {
    if (!isDeepEqual(prevElement, nextElement)) {
      videoElement.x = Math.round(x);
      videoElement.y = Math.round(y);
      videoElement.width = Math.round(width);
      videoElement.height = Math.round(height);
      videoElement.alpha = alpha ?? 1;
      syncBlurEffect(videoElement, nextElement.blur, {
        force: shouldForceBlur,
      });

      if (!didSyncResourceBeforeAnimation) {
        syncVideoResource();
      }
    }
  };

  if (prevElement.src !== nextElement.src && hasLiveAnimation) {
    const currentWidth = videoElement.width;
    const currentHeight = videoElement.height;
    syncVideoResource();
    videoElement.width = Math.round(
      hasLiveAnimationTween("width") ? currentWidth : width,
    );
    videoElement.height = Math.round(
      hasLiveAnimationTween("height") ? currentHeight : height,
    );
    didSyncResourceBeforeAnimation = true;
  }

  const dispatched = dispatchLiveAnimations({
    animations,
    targetId: prevElement.id,
    animationBus,
    completionTracker,
    element: videoElement,
    targetState: {
      x,
      y,
      width,
      height,
      alpha: alpha ?? 1,
      ...getBlurTargetState(nextElement, {
        force: shouldForceBlur,
      }),
    },
    onComplete: updateElement,
  });

  if (!dispatched) {
    // No animations, update immediately
    updateElement();
  }
};
