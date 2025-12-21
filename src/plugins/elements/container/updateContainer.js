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
          parent: (nextElement.scroll)?  
          containerElement.children.find((child) => child.label === `${nextElement.id}-content`)
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
      });
    }
    isAnimationDone = true;
    await updateElement();
    signal.removeEventListener("abort", abortController);
  }
};
