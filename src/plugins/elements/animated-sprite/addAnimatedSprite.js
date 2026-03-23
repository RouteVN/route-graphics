import { AnimatedSprite, Spritesheet, Texture } from "pixi.js";
import { setupDebugMode } from "./util/debugUtils.js";
import { queueDeferredMountEffect } from "../renderContext.js";

/**
 * Add animated sprite element to the stage
 * @param {import("../elementPlugin.js").AddElementOptions} params
 */
export const addAnimatedSprite = async ({
  app,
  parent,
  element,
  renderContext,
  zIndex,
  signal,
}) => {
  if (signal?.aborted) return;

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
  if (signal?.aborted || parent.destroyed) return;

  const frameTextures = animation.frames.map(
    (index) => spriteSheet.textures[frameNames[index]],
  );

  const animatedSprite = new AnimatedSprite(frameTextures);
  animatedSprite.label = id;
  animatedSprite.zIndex = zIndex;

  animatedSprite.animationSpeed = animation.animationSpeed ?? 0.5;
  animatedSprite.loop = animation.loop ?? true;

  if (app.debug) {
    setupDebugMode(animatedSprite, id, app.debug);
  } else {
    queueDeferredMountEffect(renderContext, () => {
      animatedSprite.play();
    });
  }

  animatedSprite.x = Math.round(x);
  animatedSprite.y = Math.round(y);
  animatedSprite.width = Math.round(width);
  animatedSprite.height = Math.round(height);
  animatedSprite.alpha = alpha;

  parent.addChild(animatedSprite);
};
