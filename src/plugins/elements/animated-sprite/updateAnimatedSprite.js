import { AnimatedSprite, Assets, Spritesheet, Texture } from "pixi.js";
import animateElements from "../../../util/animateElements.js";

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

  const updateElement = () => {
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

        const metadata = Assets.get(nextElement.metadataSrc).data;
        const frameNames = Object.keys(metadata.frames);
        const spriteSheet = new Spritesheet(
          Texture.from(nextElement.sheetSrc),
          metadata,
        );
        spriteSheet.parse();

        const frameTextures = nextElement.animation.frames.map(
          (index) => spriteSheet.textures[frameNames[index]],
        );
        animatedSpriteElement.textures = frameTextures;
        animatedSpriteElement.play();
      }
    }
  };

  const abortHandler = async () => {
    if (!isAnimationDone) {
      updateElement();
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
    updateElement();
    signal.removeEventListener("abort", abortHandler);
  }
};
