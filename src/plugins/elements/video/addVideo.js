import { Texture, Sprite } from "pixi.js";
import { syncVideoPlaybackTracking } from "./playbackTracking.js";
import { queueDeferredVideoPlay } from "../renderContext.js";
import { normalizeVolume } from "../../../util/normalizeVolume.js";
import { dispatchLiveAnimations } from "../../animations/planAnimations.js";
import {
  getBlurTargetState,
  hasBlurUpdateAnimation,
  syncBlurEffect,
} from "../util/blurEffect.js";
import {
  getShaderFilterTargetState,
  hasShaderProgressUpdateAnimation,
  syncShaderFilters,
} from "../util/shaderFilterEffect.js";
import {
  registerManagedVideoSprite,
  requestManagedVideoTextureUpdate,
} from "./managedVideoTextureSizing.js";

/**
 * Add video element to the stage
 * @param {import("../elementPlugin.js").AddElementOptions} params
 */
export const addVideo = ({
  parent,
  element,
  animations,
  animationBus,
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
  video.volume = normalizeVolume(volume);
  video.muted = false;

  const sprite = new Sprite(texture);
  sprite.label = id;
  sprite.zIndex = zIndex;
  sprite._videoEndedListener = undefined;
  sprite._videoErrorListener = undefined;
  sprite._playbackStateVersion = null;

  sprite.x = Math.round(x);
  sprite.y = Math.round(y);
  sprite.width = Math.round(width);
  sprite.height = Math.round(height);
  registerManagedVideoSprite(sprite);
  sprite.alpha = alpha ?? 1;
  const shouldForceBlur = hasBlurUpdateAnimation(animations, id);
  syncBlurEffect(sprite, element.blur, { force: shouldForceBlur });
  const shouldForceShaderProgress = hasShaderProgressUpdateAnimation(
    animations,
    id,
  );
  syncShaderFilters(sprite, element.filters, {
    width,
    height,
    force: shouldForceShaderProgress,
  });

  syncVideoPlaybackTracking({
    videoElement: sprite,
    video,
    loop,
    completionTracker,
  });

  parent.addChild(sprite);
  requestManagedVideoTextureUpdate(sprite);
  queueDeferredVideoPlay(renderContext, video);

  dispatchLiveAnimations({
    animations,
    targetId: id,
    animationBus,
    completionTracker,
    element: sprite,
    targetState: {
      x,
      y,
      width,
      height,
      alpha: alpha ?? 1,
      ...getBlurTargetState(element, { force: shouldForceBlur }),
      ...getShaderFilterTargetState(element, {
        force: shouldForceShaderProgress,
      }),
    },
    renderContext,
  });
};
