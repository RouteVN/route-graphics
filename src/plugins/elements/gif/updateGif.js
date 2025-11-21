import { Assets } from "pixi.js";
import animateElements from "../../../util/animateElements.js";

/**
 * Update gif element
 * @param {import("../elementPlugin.js").UpdateElementOptions} params
 */
export const updateGif = async ({
  app,
  parent,
  prevElement,
  nextElement,
  animations,
  animationPlugins,
  eventHandler,
  signal,
}) => {
  if (signal?.aborted) {
    return;
  }

  const gifElement = parent.children.find(
    (child) => child.label === prevElement.id,
  );

  if (!gifElement) return;

  const updateElement = async () => {
    if (JSON.stringify(prevElement) !== JSON.stringify(nextElement)) {
      // If src changes, we need to reload the source
      if (prevElement.src !== nextElement.src) {
        const newSource = await Assets.load(nextElement.src);
        if (signal?.aborted) return;
        gifElement.source = newSource;
      }

      gifElement.x = Math.round(nextElement.x);
      gifElement.y = Math.round(nextElement.y);
      if (nextElement.width) gifElement.width = Math.round(nextElement.width);
      if (nextElement.height)
        gifElement.height = Math.round(nextElement.height);
      gifElement.alpha = nextElement.alpha;

      // Update GIF specific properties
      if (prevElement.loop !== nextElement.loop)
        gifElement.loop = nextElement.loop;
      if (prevElement.animationSpeed !== nextElement.animationSpeed)
        gifElement.animationSpeed = nextElement.animationSpeed;

      // If autoPlay status changes or we just loaded new source, handle play state
      if (nextElement.autoPlay && !gifElement.playing) {
        gifElement.play();
      } else if (!nextElement.autoPlay && gifElement.playing) {
        gifElement.stop();
      }

      gifElement.removeAllListeners("pointerover");
      gifElement.removeAllListeners("pointerout");
      gifElement.removeAllListeners("pointerup");

      const hoverEvents = nextElement?.hover;
      const clickEvents = nextElement?.click;

      if (hoverEvents) {
        const { cursor, soundSrc, actionPayload } = hoverEvents;
        gifElement.eventMode = "static";

        const overListener = () => {
          if (actionPayload && eventHandler)
            eventHandler(`${gifElement.label}-pointer-over`, {
              _event: {
                id: gifElement.label,
              },
              ...actionPayload,
            });
          if (cursor) gifElement.cursor = cursor;
          if (soundSrc)
            app.audioStage.add({
              id: `hover-${Date.now()}`,
              url: soundSrc,
              loop: false,
            });
        };

        const outListener = () => {
          gifElement.cursor = "auto";
        };

        gifElement.on("pointerover", overListener);
        gifElement.on("pointerout", outListener);
      }

      if (clickEvents) {
        const { soundSrc, actionPayload } = clickEvents;
        gifElement.eventMode = "static";

        const releaseListener = () => {
          if (actionPayload && eventHandler)
            eventHandler(`${gifElement.label}-click`, {
              _event: {
                id: gifElement.label,
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

        gifElement.on("pointerup", releaseListener);
      }
    }
  };

  signal.addEventListener("abort", () => {
    updateElement();
  });

  if (animations && animations.length > 0) {
    await animateElements(prevElement.id, animationPlugins, {
      app,
      element: gifElement,
      animations,
      signal,
    });
  }
  await updateElement();
};