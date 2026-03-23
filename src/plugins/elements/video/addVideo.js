import { Texture, Sprite } from "pixi.js";
import { syncVideoPlaybackTracking } from "./playbackTracking.js";
import { queueDeferredMountEffect } from "../renderContext.js";

/**
 * Add video element to the stage
 * @param {import("../elementPlugin.js").AddElementOptions} params
 */
export const addVideo = ({
  app,
  parent,
  element,
  renderContext,
  completionTracker,
  zIndex,
}) => {
  const { id, x, y, width, height, src, volume, loop, alpha } = element;

  const texture = Texture.from(src);
  const video = texture.source.resource;

  video.pause();
  video.currentTime = 0;
  video.loop = loop ?? false;
  video.volume = volume / 1000;
  video.muted = false;

  const sprite = new Sprite(texture);
  sprite.label = id;
  sprite.zIndex = zIndex;
  sprite._videoEndedListener = undefined;
  sprite._playbackStateVersion = null;

  sprite.x = Math.round(x);
  sprite.y = Math.round(y);
  sprite.width = Math.round(width);
  sprite.height = Math.round(height);
  sprite.alpha = alpha ?? 1;

  syncVideoPlaybackTracking({
    videoElement: sprite,
    video,
    loop,
    completionTracker,
  });

  queueDeferredMountEffect(renderContext, () => {
    video.play();
  });

  parent.addChild(sprite);
};
