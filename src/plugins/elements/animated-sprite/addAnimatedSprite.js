import { AnimatedSprite, Spritesheet, Texture } from "pixi.js";
import { setupDebugMode } from "./util/debugUtils.js";
import { queueDeferredAnimatedSpritePlay } from "../renderContext.js";
import {
  normalizeAnimatedSpriteAtlas,
  normalizeAnimatedSpriteClips,
  normalizeAnimatedSpritePlayback,
  playbackFpsToAnimationSpeed,
  resolveAnimatedSpriteFrameTextures,
} from "./animatedSpriteConfig.js";

/**
 * Add spritesheet animation element to the stage
 * @param {import("../elementPlugin.js").AddElementOptions} params
 */
export const addAnimatedSprite = async ({
  app,
  parent,
  element,
  renderContext,
  completionTracker,
  zIndex,
  signal,
}) => {
  if (signal?.aborted) return;

  const { id, x, y, width, height, src, atlas, clips, playback, alpha } =
    element;

  const normalizedAtlas = normalizeAnimatedSpriteAtlas(atlas);
  const normalizedClips = normalizeAnimatedSpriteClips(
    clips,
    atlas?.animations,
    atlas?.meta,
    Object.keys(normalizedAtlas.frames ?? {}),
  );
  const normalizedPlayback = normalizeAnimatedSpritePlayback({
    atlas: normalizedAtlas,
    clips: normalizedClips,
    playback,
  });
  const completionVersion = completionTracker?.getVersion?.();
  completionTracker?.track?.(completionVersion);

  try {
    const spriteSheet = new Spritesheet(Texture.from(src), normalizedAtlas);
    await spriteSheet.parse();
    if (signal?.aborted || parent.destroyed) return;

    const { frameTextures } = resolveAnimatedSpriteFrameTextures({
      spritesheet: spriteSheet,
      atlas: normalizedAtlas,
      clips: normalizedClips,
      playback: normalizedPlayback,
    });

    const animatedSprite = new AnimatedSprite(frameTextures);
    animatedSprite.label = id;
    animatedSprite.zIndex = zIndex;

    animatedSprite.animationSpeed = playbackFpsToAnimationSpeed(
      normalizedPlayback.fps,
    );
    animatedSprite.loop = normalizedPlayback.loop;

    if (app.debug) {
      setupDebugMode(animatedSprite, id, app.debug, () => {
        if (typeof app.render === "function") {
          app.render();
        }
      });
    } else if (normalizedPlayback.autoplay) {
      queueDeferredAnimatedSpritePlay(renderContext, animatedSprite);
    }

    animatedSprite.x = Math.round(x);
    animatedSprite.y = Math.round(y);
    animatedSprite.width = Math.round(width);
    animatedSprite.height = Math.round(height);
    animatedSprite.alpha = alpha;

    parent.addChild(animatedSprite);

    if (typeof app.render === "function") {
      app.render();
    }
  } finally {
    completionTracker?.complete?.(completionVersion);
  }
};
