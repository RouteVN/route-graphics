import { renderElements } from "../renderElements.js";
import { setupScrolling, removeScrolling } from "./util/scrollingUtils.js";
import { collectAllElementIds } from "../../../util/collectElementIds.js";
import { isDeepEqual } from "../../../util/isDeepEqual.js";
import { dispatchLiveAnimations } from "../../animations/liveAnimationUtils.js";
import { getTargetAnimations } from "../../animations/planAnimations.js";

/**
 * Update container element (synchronous)
 * @typedef {import("../elementPlugin.js").UpdateElementOptions} UpdateElementOptions
 * @typedef {import("../elementPlugin.js").ElementPlugin} ElementPlugin
 * @param {UpdateElementOptions && {elementPlugins: ElementPlugin[]}} params
 */
export const updateContainer = ({
  app,
  parent,
  prevElement,
  nextElement,
  eventHandler,
  animations,
  animationBus,
  elementPlugins,
  zIndex,
  completionTracker,
  signal,
}) => {
  const containerElement = parent.children.find(
    (child) => child.label === prevElement.id,
  );

  if (!containerElement) return;

  containerElement.zIndex = zIndex;

  const { x, y, alpha } = nextElement;

  const updateElement = () => {
    if (!isDeepEqual(prevElement, nextElement)) {
      containerElement.x = Math.round(x);
      containerElement.y = Math.round(y);
      containerElement.label = nextElement.id;
      containerElement.alpha = alpha;

      containerElement.removeAllListeners("pointerover");
      containerElement.removeAllListeners("pointerout");
      containerElement.removeAllListeners("pointerup");
      containerElement.removeAllListeners("rightclick");
      containerElement.eventMode = "auto";
      containerElement.cursor = "auto";

      const hoverEvents = nextElement?.hover;
      const clickEvents = nextElement?.click;
      const rightClickEvents = nextElement?.rightClick;
      const hasPointerInteraction = Boolean(
        hoverEvents || clickEvents || rightClickEvents,
      );

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
        const { soundSrc, soundVolume, actionPayload } = clickEvents;
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
              volume: (soundVolume ?? 1000) / 1000,
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

      const prevUsesViewport = prevElement.scroll || prevElement.anchorToBottom;
      const nextUsesViewport = nextElement.scroll || nextElement.anchorToBottom;

      if (prevUsesViewport !== nextUsesViewport) {
        if (nextUsesViewport) {
          setupScrolling({
            container: containerElement,
            element: nextElement,
            interactive: !!nextElement.scroll,
            allowViewportWithoutScroll: !!nextElement.anchorToBottom,
          });
        } else {
          removeScrolling({
            container: containerElement,
          });
        }
      } else if (nextUsesViewport) {
        removeScrolling({
          container: containerElement,
        });
        setupScrolling({
          container: containerElement,
          element: nextElement,
          interactive: !!nextElement.scroll,
          allowViewportWithoutScroll: !!nextElement.anchorToBottom,
        });
      }

      if (!nextElement.scroll && hasPointerInteraction) {
        containerElement.eventMode = "static";
      }
    }

    // Check if children definition changed
    const childrenChanged = !isDeepEqual(
      prevElement.children,
      nextElement.children,
    );

    // Check if any animation targets a child element
    const childIds = collectAllElementIds({ children: nextElement.children });
    const hasChildAnimation = Array.from(childIds).some(
      (childId) => getTargetAnimations(animations, childId).length > 0,
    );

    // Render children if definition changed OR animation targets children
    if (childrenChanged || hasChildAnimation) {
      const contentContainer = containerElement.children.find(
        (child) => child.label === `${nextElement.id}-content`,
      );
      const renderParent = contentContainer || containerElement;

      renderElements({
        app,
        parent: renderParent,
        nextComputedTree: nextElement.children,
        prevComputedTree: prevElement.children,
        eventHandler,
        elementPlugins,
        animations,
        animationBus,
        completionTracker,
        signal,
      });
    }
  };

  const dispatched = dispatchLiveAnimations({
    animations,
    targetId: prevElement.id,
    operation: "update",
    animationBus,
    completionTracker,
    element: containerElement,
    targetState: { x, y, alpha },
    onComplete: () => {
      updateElement();
    },
  });

  if (!dispatched) {
    // No animations, update immediately
    updateElement();
  }
};
