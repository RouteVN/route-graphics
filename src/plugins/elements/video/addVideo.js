import { Texture, Sprite } from "pixi.js";
import animateElements from "../../../util/animateElements.js";

/**
 * Add video element to the stage
 * @param {import("../elementPlugin.js").AddElementOptions} params
 */
export const addVideo = async ({
  app,
  parent,
  element,
  animations,
  eventHandler,
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
    src,
    volume,
    loop,
    alpha,
  } = element;

  const texture = Texture.from(src);
  const video = texture.source.resource;

  video.loop = loop ?? false;

  if (volume) {
    const audioElement = {
      id: id,
      url: src,
      loop: loop ?? false,
      volume: volume / 1000,
    };
    app.audioStage.add(audioElement);
  }

  const sprite = new Sprite(texture);
  sprite.label = id;

  const drawVideo = () => {
    sprite.x = Math.round(x);
    sprite.y = Math.round(y);
    sprite.width = Math.round(width);
    sprite.height = Math.round(height);
    sprite.alpha = alpha ?? 1;
  };

  const abortHandler = async () => {
    if (!isAnimationDone) {
      drawVideo();
    }
  };

  signal.addEventListener("abort", abortHandler);
  drawVideo();

  parent.addChild(sprite);

  if (animations && animations.length > 0) {
    isAnimationDone = false;
    await animateElements(id, animationPlugins, {
      app,
      element: sprite,
      animations,
      signal,
    });
    isAnimationDone = true;
  }

  signal.removeEventListener("abort", abortHandler);
};