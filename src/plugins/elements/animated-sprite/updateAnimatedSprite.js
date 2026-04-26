import { Spritesheet, Texture } from "pixi.js";
import { setupDebugMode, cleanupDebugMode } from "./util/debugUtils.js";
import { isDeepEqual } from "../../../util/isDeepEqual.js";
import { dispatchLiveAnimations } from "../../animations/planAnimations.js";
import {
  getBlurTargetState,
  hasBlurUpdateAnimation,
  syncBlurEffect,
} from "../util/blurEffect.js";
import {
  normalizeAnimatedSpriteAtlas,
  normalizeAnimatedSpriteClips,
  normalizeAnimatedSpritePlayback,
  playbackFpsToAnimationSpeed,
  resolveAnimatedSpriteFrameTextures,
} from "./animatedSpriteConfig.js";

/**
 * Update spritesheet animation element
 * @param {import("../elementPlugin.js").UpdateElementOptions} params
 */
export const updateAnimatedSprite = async ({
  app,
  parent,
  prevElement,
  nextElement,
  animations,
  animationBus,
  completionTracker,
  zIndex,
  signal,
}) => {
  if (signal?.aborted) return;

  const animatedSpriteElement = parent.children.find(
    (child) => child.label === prevElement.id,
  );

  if (!animatedSpriteElement) return;

  animatedSpriteElement.zIndex = zIndex;
  const shouldForceBlur = hasBlurUpdateAnimation(animations, prevElement.id);
  if (shouldForceBlur) {
    syncBlurEffect(animatedSpriteElement, prevElement.blur, { force: true });
  }

  const updateElement = async () => {
    if (signal?.aborted || animatedSpriteElement.destroyed) return;

    if (!isDeepEqual(prevElement, nextElement)) {
      const nextSrc = nextElement.src;
      const nextAtlas = normalizeAnimatedSpriteAtlas(nextElement.atlas);
      const nextClips = normalizeAnimatedSpriteClips(
        nextElement.clips,
        nextElement.atlas?.animations,
        nextElement.atlas?.meta,
        Object.keys(nextAtlas.frames ?? {}),
      );
      const nextPlayback = normalizeAnimatedSpritePlayback({
        atlas: nextAtlas,
        clips: nextClips,
        playback: nextElement.playback,
      });

      animatedSpriteElement.x = Math.round(nextElement.x);
      animatedSpriteElement.y = Math.round(nextElement.y);
      animatedSpriteElement.width = Math.round(nextElement.width);
      animatedSpriteElement.height = Math.round(nextElement.height);
      animatedSpriteElement.alpha = nextElement.alpha;
      syncBlurEffect(animatedSpriteElement, nextElement.blur, {
        force: shouldForceBlur,
      });

      const playbackChanged = !isDeepEqual(
        prevElement.playback,
        nextElement.playback,
      );
      const clipSetChanged = !isDeepEqual(prevElement.clips, nextElement.clips);
      const atlasChanged =
        prevElement.src !== nextSrc ||
        !isDeepEqual(prevElement.atlas, nextElement.atlas);

      animatedSpriteElement.animationSpeed = playbackFpsToAnimationSpeed(
        nextPlayback.fps,
      );
      animatedSpriteElement.loop = nextPlayback.loop;

      if (playbackChanged || clipSetChanged || atlasChanged) {
        const completionVersion = completionTracker?.getVersion?.();
        completionTracker?.track?.(completionVersion);

        try {
          const spriteSheet = new Spritesheet(Texture.from(nextSrc), nextAtlas);
          await spriteSheet.parse();
          if (signal?.aborted || animatedSpriteElement.destroyed) return;

          const { frameTextures } = resolveAnimatedSpriteFrameTextures({
            spritesheet: spriteSheet,
            atlas: nextAtlas,
            clips: nextClips,
            playback: nextPlayback,
          });
          animatedSpriteElement.textures = frameTextures;
          if (typeof app.render === "function") {
            app.render();
          }

          if (!app.debug && nextPlayback.autoplay) {
            animatedSpriteElement.play();
          } else {
            if (!app.debug) {
              animatedSpriteElement.stop?.();
            }

            if (prevElement.id !== nextElement.id) {
              cleanupDebugMode(animatedSpriteElement);
              setupDebugMode(
                animatedSpriteElement,
                nextElement.id,
                app.debug,
                () => {
                  if (typeof app.render === "function") {
                    app.render();
                  }
                },
              );
            }
          }
        } finally {
          completionTracker?.complete?.(completionVersion);
        }
      }
    }
  };

  const { x, y, width, height, alpha } = nextElement;

  const dispatched = dispatchLiveAnimations({
    animations,
    targetId: prevElement.id,
    animationBus,
    completionTracker,
    element: animatedSpriteElement,
    targetState: {
      x,
      y,
      width,
      height,
      alpha,
      ...getBlurTargetState(nextElement, {
        force: shouldForceBlur,
      }),
    },
    onComplete: () => {
      void updateElement();
    },
  });

  if (!dispatched) {
    // No animations, update immediately
    await updateElement();
  }
};
