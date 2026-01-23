import { Texture } from "pixi.js";

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
    if (JSON.stringify(prevElement) !== JSON.stringify(nextElement)) {
      videoElement.x = Math.round(x);
      videoElement.y = Math.round(y);
      videoElement.width = Math.round(width);
      videoElement.height = Math.round(height);
      videoElement.alpha = alpha ?? 1;

      if (prevElement.src !== nextElement.src) {
        const oldVideo = videoElement.texture.source.resource;
        if (oldVideo) {
          oldVideo.pause();
        }

        const newTexture = Texture.from(nextElement.src);
        videoElement.texture = newTexture;

        const newVideo = newTexture.source.resource;
        newVideo.muted = false;
        newVideo.pause();
        newVideo.currentTime = 0;
        newVideo.play();
      }
      videoElement.texture.source.resource.volume = nextElement.volume / 1000;
      videoElement.texture.source.resource.loop = nextElement.loop ?? false;
    }
  };

  // Dispatch animations to the bus
  const relevantAnimations =
    animations?.filter((a) => a.targetId === prevElement.id) || [];

  if (relevantAnimations.length > 0) {
    for (const animation of relevantAnimations) {
      const stateVersion = completionTracker.getVersion();
      completionTracker.track(stateVersion);

      animationBus.dispatch({
        type: "START",
        payload: {
          id: animation.id,
          element: videoElement,
          properties: animation.properties,
          targetState: { x, y, width, height, alpha: alpha ?? 1 },
          onComplete: () => {
            completionTracker.complete(stateVersion);
            updateElement();
          },
        },
      });
    }
  } else {
    // No animations, update immediately
    updateElement();
  }
};
