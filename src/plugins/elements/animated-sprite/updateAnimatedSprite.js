import { AnimatedSprite, Spritesheet, Texture } from "pixi.js";
import animateElements from "../../../util/animateElements.js";
import { setupDebugMode, cleanupDebugMode } from "./util/debugUtils.js";

/**
 * Update animated sprite element
 * @param {import("../elementPlugin.js").UpdateElementOptions} params
 */
export const updateAnimatedSprite = async ({
  app,
  parent,
  prevElement,
  nextElement,
  animations,
  animationPlugins,
  signal,
}) => {
  const animatedSpriteElement = parent.children.find(
    (child) => child.label === prevElement.id,
  );

  let isAnimationDone = true;

  const updateElement = async () => {
    if (JSON.stringify(prevElement) !== JSON.stringify(nextElement)) {
      animatedSpriteElement.x = Math.round(nextElement.x);
      animatedSpriteElement.y = Math.round(nextElement.y);
      animatedSpriteElement.width = Math.round(nextElement.width);
      animatedSpriteElement.height = Math.round(nextElement.height);
      animatedSpriteElement.alpha = nextElement.alpha;

      if (
        JSON.stringify(prevElement.animation) !==
        JSON.stringify(nextElement.animation)
      ) {
        animatedSpriteElement.animationSpeed =
          nextElement.animation.animationSpeed ?? 0.5;
        animatedSpriteElement.loop = nextElement.animation.loop ?? true;

        const metadata = nextElement.spritesheetData;
        const frameNames = Object.keys(metadata.frames);
        const spriteSheet = new Spritesheet(
          Texture.from(nextElement.sheetSrc),
          metadata,
        );
        await spriteSheet.parse();

        const frameTextures = nextElement.animation.frames.map(
          (index) => spriteSheet.textures[frameNames[index]],
        );
        animatedSpriteElement.textures = frameTextures;

        if (!app.debug) {
          animatedSpriteElement.play();
        } else {
          if (prevElement.id !== nextElement.id) {
            cleanupDebugMode(animatedSpriteElement);
            setupDebugMode(animatedSpriteElement, nextElement.id, app.debug);
          }
        }
      }
    }
  };

  const abortHandler = async () => {
    if (!isAnimationDone) {
      await updateElement();
    }
  };

  signal.addEventListener("abort", abortHandler);

  if (animatedSpriteElement) {
    if (animations && animations.length > 0) {
      isAnimationDone = false;
      await animateElements(prevElement.id, animationPlugins, {
        app,
        element: animatedSpriteElement,
        animations,
        signal,
      });
      isAnimationDone = true;
    }
    await updateElement();
    signal.removeEventListener("abort", abortHandler);
  }
};
