import animateElements from "../../../util/animateElements.js";
import { renderElements } from "../../renderElements.js";

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
  if (signal?.aborted) {
    return;
  }

  const containerElement = parent.children.find(
    (child) => child.label === prevElement.id,
  );

  const updateElement = async () => {
    if (JSON.stringify(prevElement) !== JSON.stringify(nextElement)) {
      containerElement.x = Math.round(nextElement.x);
      containerElement.y = Math.round(nextElement.y);
      containerElement.label = nextElement.id;
      containerElement.alpha = nextElement.alpha;

      if (
        JSON.stringify(prevElement.children) !==
        JSON.stringify(nextElement.children)
      ) {
        renderElements({
          app,
          parent: containerElement,
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

  signal.addEventListener("abort", () => {
    updateElement();
  });

  if (containerElement) {
    if (animations && animations.length > 0) {
      await animateElements(prevElement.id, animationPlugins, {
        app,
        element: containerElement,
        animations,
        signal,
      });
    }
    await updateElement();
  }
};
