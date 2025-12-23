import { AnimatedSprite, Assets, Spritesheet, Texture } from "pixi.js";
import animateElements from "../../../util/animateElements.js";

/**
 * Add animated sprite element to the stage
 * @param {import("../elementPlugin.js").AddElementOptions} params
 */
export const addAnimatedSprite = async ({
  app,
  parent,
  element,
  animations,
  animationPlugins,
  signal,
}) => {
  let isAnimationDone = true;
  const { id, x, y, width, height, sheetSrc, metadataSrc, animation, alpha } = element;
  console.log('Adding animated sprite with metadata:', Assets.get(metadataSrc));
  console.log('sheetSrc:', Texture.from(sheetSrc));
  const spriteSheet = new Spritesheet(
    Texture.from(sheetSrc),
    Assets.get(metadataSrc).data,
  );
  await spriteSheet.parse();
  console.log("Parsed spritesheet:", spriteSheet);
  const frameTextures = animation.frames.map((frameName) =>
    Texture.from(frameName),
  );

  const animatedSprite = new AnimatedSprite(frameTextures);
  console.log("Created animated sprite:", animatedSprite);
  animatedSprite.label = id;

  animatedSprite.animationSpeed = animation.frameRate / 60;
  animatedSprite.loop = animation.loop ?? true;
  animatedSprite.play();

  const drawSprite = () => {
    animatedSprite.x = Math.round(x);
    animatedSprite.y = Math.round(y);
    animatedSprite.width = Math.round(width);
    animatedSprite.height = Math.round(height);
    animatedSprite.alpha = alpha;
  };

  const abortHandler = async () => {
    if (!isAnimationDone) {
      drawSprite();
    }
  };

  signal.addEventListener("abort", abortHandler);
  drawSprite();

  parent.addChild(animatedSprite);

  if (animations && animations.length > 0) {
    isAnimationDone = false;
    await animateElements(id, animationPlugins, {
      app,
      element: animatedSprite,
      animations,
      signal,
    });
    isAnimationDone = true;
  }

  signal.removeEventListener("abort", abortHandler);
};
