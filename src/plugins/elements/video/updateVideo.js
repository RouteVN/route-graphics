import { Texture, Sprite } from "pixi.js";
import animateElements from "../../../util/animateElements.js";

/**
 * Update video element
 * @param {import("../elementPlugin.js").UpdateElementOptions} params
 */
export const updateVideo = async ({
  app,
  parent,
  prevElement,
  nextElement,
  animations,
  animationPlugins,
  signal,
}) => {
  const videoElement = parent.children.find(
    (child) => child.label === prevElement.id,
  );

  let isAnimationDone = true;

  const updateElement = () => {
    if (JSON.stringify(prevElement) !== JSON.stringify(nextElement)) {
      videoElement.x = Math.round(nextElement.x);
      videoElement.y = Math.round(nextElement.y);
      videoElement.width = Math.round(nextElement.width);
      videoElement.height = Math.round(nextElement.height);
      videoElement.alpha = nextElement.alpha ?? 1;

      const audioElement = app.audioStage.getById(prevElement.id);
      if (audioElement) {
        audioElement.url = nextElement.src;
        audioElement.volume = nextElement.volume / 1000;
        audioElement.loop = nextElement.loop ?? false;
      }
    }
  };

  const abortHandler = async () => {
    if (!isAnimationDone) {
      updateElement();
    }
  };

  signal.addEventListener("abort", abortHandler);

  if (videoElement) {
    if (animations && animations.length > 0) {
      isAnimationDone = false;
      await animateElements(prevElement.id, animationPlugins, {
        app,
        element: videoElement,
        animations: animations,
        signal,
      });
      isAnimationDone = true;
    }
    updateElement();
    signal.removeEventListener("abort", abortHandler);
  }
};