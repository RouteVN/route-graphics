import { AnimatedSprite, Spritesheet, Texture } from "pixi.js";
import animateElements from "../../../util/animateElements.js";
import { setupDebugMode } from "./util/debugUtils.js";

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
  const {
    id,
    x,
    y,
    width,
    height,
    spritesheetSrc,
    spritesheetData,
    animation,
    alpha,
  } = element;

  const metadata = spritesheetData;
  const frameNames = Object.keys(metadata.frames);

  const spriteSheet = new Spritesheet(Texture.from(spritesheetSrc), metadata);
  await spriteSheet.parse();

  const frameTextures = animation.frames.map(
    (index) => spriteSheet.textures[frameNames[index]],
  );

  const animatedSprite = new AnimatedSprite(frameTextures);
  animatedSprite.label = id;

  animatedSprite.animationSpeed = animation.animationSpeed ?? 0.5;
  animatedSprite.loop = animation.loop ?? true;

  if (!app.debug) animatedSprite.play();
  else setupDebugMode(animatedSprite, id, app.debug);

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
