import { Assets } from "pixi.js";
import { GifSprite } from "pixi.js/gif";
import animateElements from "../../../util/animateElements.js";

/**
 * Add gif element to the stage
 * @param {import("../elementPlugin.js").AddElementOptions} params
 */
export const addGif = async ({
  app,
  parent,
  element,
  animations,
  eventHandler,
  animationPlugins,
  signal,
}) => {
  if (signal?.aborted) {
    return;
  }

  const {
    id,
    x,
    y,
    width,
    height,
    src,
    alpha,
    loop,
    autoPlay,
    animationSpeed,
  } = element;

  // Load the GifSource
  const source = await Assets.load(src);

  if (signal?.aborted) return;

  const gif = new GifSprite({
    source,
    loop,
    autoPlay,
    animationSpeed,
  });
  gif.label = id;

  const drawGif = () => {
    gif.x = Math.round(x);
    gif.y = Math.round(y);
    if (width) gif.width = Math.round(width);
    if (height) gif.height = Math.round(height);
    gif.alpha = alpha;
  };

  signal.addEventListener("abort", () => {
    drawGif();
  });
  drawGif();

  const hoverEvents = element?.hover;
  const clickEvents = element?.click;

  if (hoverEvents) {
    const { cursor, soundSrc, actionPayload } = hoverEvents;
    gif.eventMode = "static";

    const overListener = () => {
      if (actionPayload && eventHandler)
        eventHandler(`${gif.label}-pointer-over`, {
          _event: {
            id: gif.label,
          },
          ...actionPayload,
        });
      if (cursor) gif.cursor = cursor;
      if (soundSrc)
        app.audioStage.add({
          id: `hover-${Date.now()}`,
          url: soundSrc,
          loop: false,
        });
    };

    const outListener = () => {
      gif.cursor = "auto";
    };

    gif.on("pointerover", overListener);
    gif.on("pointerout", outListener);
  }

  if (clickEvents) {
    const { soundSrc, actionPayload } = clickEvents;
    gif.eventMode = "static";

    const releaseListener = () => {
      if (actionPayload && eventHandler)
        eventHandler(`${gif.label}-click`, {
          _event: {
            id: gif.label,
          },
          ...actionPayload,
        });
      if (soundSrc)
        app.audioStage.add({
          id: `click-${Date.now()}`,
          url: soundSrc,
          loop: false,
        });
    };

    gif.on("pointerup", releaseListener);
  }

  parent.addChild(gif);

  if (animations && animations.length > 0) {
    await animateElements(id, animationPlugins, {
      app,
      element: gif,
      animations,
      signal,
    });
  }
};
