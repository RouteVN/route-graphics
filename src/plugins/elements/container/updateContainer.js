import animateElements from "../../../util/animateElements.js";
import { renderElements } from "../renderElements.js";
import { setupScrolling, removeScrolling } from "./util/scrollingUtils.js";

/**
 * Update container element
 * @typedef {import("../elementPlugin.js").UpdateElementOptions} UpdateElementOptions
 * @typedef {import("../elementPlugin.js").ElementPlugin} ElementPlugin
 * @param {UpdateElementOptions && {elementPlugins: ElementPlugin[]}} params
 */
export const updateContainer = async ({
  app,
  parent,
  prevElement,
  nextElement,
  eventHandler,
  animations,
  animationPlugins,
  elementPlugins,
  signal,
}) => {
  const containerElement = parent.children.find(
    (child) => child.label === prevElement.id,
  );
  let isAnimationDone = true;

  const updateElement = async () => {
    if (JSON.stringify(prevElement) !== JSON.stringify(nextElement)) {
      containerElement.x = Math.round(nextElement.x);
      containerElement.y = Math.round(nextElement.y);
      containerElement.label = nextElement.id;
      containerElement.alpha = nextElement.alpha;

      containerElement.removeAllListeners("pointerover");
      containerElement.removeAllListeners("pointerout");
      containerElement.removeAllListeners("pointerup");
      containerElement.removeAllListeners("rightclick");

      const hoverEvents = nextElement?.hover;
      const clickEvents = nextElement?.click;
      const rightClickEvents = nextElement?.rightClick;

      if (hoverEvents) {
        const { cursor, soundSrc, actionPayload } = hoverEvents;
        containerElement.eventMode = "static";

        const overListener = () => {
          if (actionPayload && eventHandler)
            eventHandler(`hover`, {
              _event: {
                id: containerElement.label,
              },
              ...actionPayload,
            });
          if (cursor) containerElement.cursor = cursor;
          if (soundSrc)
            app.audioStage.add({
              id: `hover-${Date.now()}`,
              url: soundSrc,
              loop: false,
            });
        };

        const outListener = () => {
          containerElement.cursor = "auto";
        };

        containerElement.on("pointerover", overListener);
        containerElement.on("pointerout", outListener);
      }

      if (clickEvents) {
        const { soundSrc, actionPayload } = clickEvents;
        containerElement.eventMode = "static";

        const releaseListener = () => {
          if (actionPayload && eventHandler)
            eventHandler(`click`, {
              _event: {
                id: containerElement.label,
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

        containerElement.on("pointerup", releaseListener);
      }

      if (rightClickEvents) {
        const { soundSrc, actionPayload } = rightClickEvents;
        containerElement.eventMode = "static";

        const rightClickListener = () => {
          if (actionPayload && eventHandler)
            eventHandler(`rightclick`, {
              _event: {
                id: containerElement.label,
              },
              ...actionPayload,
            });
          if (soundSrc)
            app.audioStage.add({
              id: `rightclick-${Date.now()}`,
              url: soundSrc,
              loop: false,
            });
        };

        containerElement.on("rightclick", rightClickListener);
      }

      if (prevElement.scroll !== nextElement.scroll) {
        if (nextElement.scroll) {
          setupScrolling({
            container: containerElement,
            element: nextElement,
          });
        } else {
          removeScrolling({
            container: containerElement,
          });
        }
      } else if (nextElement.scroll) {
        removeScrolling({
          container: containerElement,
        });
        setupScrolling({
          container: containerElement,
          element: nextElement,
        });
      }

      if (
        JSON.stringify(prevElement.children) !==
        JSON.stringify(nextElement.children)
      ) {
        await renderElements({
          app,
          parent: nextElement.scroll
            ? containerElement.children.find(
                (child) => child.label === `${nextElement.id}-content`,
              )
            : containerElement,
          nextASTTree: nextElement.children,
          prevASTTree: prevElement.children,
          eventHandler,
          elementPlugins,
          animations,
          animationPlugins,
          signal,
        });
      }
    }
  };

  const abortController = async () => {
    if (!isAnimationDone) {
      await updateElement();
    }
  };

  signal.addEventListener("abort", abortController);

  if (containerElement) {
    if (animations && animations.length > 0) {
      isAnimationDone = false;
      await animateElements(prevElement.id, animationPlugins, {
        app,
        element: containerElement,
        animations,
        signal,
        eventHandler,
      });
    }
    isAnimationDone = true;
    await updateElement();
    signal.removeEventListener("abort", abortController);
  }
};
