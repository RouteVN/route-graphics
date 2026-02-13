import { Texture, Sprite, Assets } from "pixi.js";

/**
 * Add video element to the stage
 * @param {import("../elementPlugin.js").AddElementOptions} params
 */
export const addVideo = ({
  app,
  parent,
  element,
  animations,
  eventHandler,
  animationBus,
  completionTracker,
  zIndex,
}) => {
  const { id, x, y, width, height, src, volume, loop, alpha } = element;

  const texture = Texture.from(src);
  const video = texture.source.resource;

  video.pause();
  video.currentTime = 0;
  video.loop = loop ?? false;
  video.volume = volume / 1000;
  video.muted = false;

  // Add ended event listener
  const onEnded = () => {
    if (eventHandler) {
      eventHandler("videoEnd", {
        _event: { id },
      });
    }
  };
  video.addEventListener("ended", onEnded);

  video.play();

  const sprite = new Sprite(texture);
  sprite.label = id;
  sprite.zIndex = zIndex;
  sprite._videoEndedListener = onEnded;

  sprite.x = Math.round(x);
  sprite.y = Math.round(y);
  sprite.width = Math.round(width);
  sprite.height = Math.round(height);
  sprite.alpha = alpha ?? 1;

  parent.addChild(sprite);

  // Dispatch animations to the bus
  const relevantAnimations = animations?.filter((a) => a.targetId === id) || [];

  for (const animation of relevantAnimations) {
    const stateVersion = completionTracker.getVersion();
    completionTracker.track(stateVersion);

    animationBus.dispatch({
      type: "START",
      payload: {
        id: animation.id,
        element: sprite,
        properties: animation.properties,
        targetState: { x, y, width, height, alpha: alpha ?? 1 },
        onComplete: () => {
          completionTracker.complete(stateVersion);
        },
      },
    });
  }
};
