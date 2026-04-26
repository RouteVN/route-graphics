import { renderElements } from "../renderElements.js";
import {
  getScrollingState,
  setupScrolling,
  removeScrolling,
} from "./util/scrollingUtils.js";
import {
  bindContainerInteractions,
  reapplyContainerInheritedHover,
  reapplyContainerInheritedPress,
  reapplyContainerInheritedRightPress,
} from "./util/bindContainerInteractions.js";
import { collectAllElementIds } from "../../../util/collectElementIds.js";
import { isDeepEqual } from "../../../util/isDeepEqual.js";
import { dispatchLiveAnimations } from "../../animations/planAnimations.js";
import { getTargetAnimations } from "../../animations/planAnimations.js";
import {
  getBlurTargetState,
  hasBlurUpdateAnimation,
  syncBlurEffect,
} from "../util/blurEffect.js";

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
  renderContext,
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
  const shouldForceBlur = hasBlurUpdateAnimation(animations, prevElement.id);
  if (shouldForceBlur) {
    syncBlurEffect(containerElement, prevElement.blur, { force: true });
  }

  const updateElement = () => {
    if (!isDeepEqual(prevElement, nextElement)) {
      containerElement.x = Math.round(x);
      containerElement.y = Math.round(y);
      containerElement.label = nextElement.id;
      containerElement.alpha = alpha;
      containerElement.scale.x = 1;
      containerElement.scale.y = 1;
      syncBlurEffect(containerElement, nextElement.blur, {
        force: shouldForceBlur,
      });

      const prevUsesViewport = prevElement.scroll || prevElement.anchorToBottom;
      const nextUsesViewport = nextElement.scroll || nextElement.anchorToBottom;
      const previousScrollState = nextUsesViewport
        ? getScrollingState({
            container: containerElement,
          })
        : null;

      if (prevUsesViewport !== nextUsesViewport) {
        if (nextUsesViewport) {
          setupScrolling({
            container: containerElement,
            element: nextElement,
            interactive: !!nextElement.scroll,
            allowViewportWithoutScroll: !!nextElement.anchorToBottom,
            previousState: previousScrollState,
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
          previousState: previousScrollState,
        });
      }

      bindContainerInteractions({
        app,
        container: containerElement,
        element: nextElement,
        eventHandler,
      });
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
        renderContext,
        signal,
      });

      reapplyContainerInheritedHover({
        container: containerElement,
      });
      reapplyContainerInheritedPress({
        container: containerElement,
      });
      reapplyContainerInheritedRightPress({
        container: containerElement,
      });
    }
  };

  const dispatched = dispatchLiveAnimations({
    animations,
    targetId: prevElement.id,
    animationBus,
    completionTracker,
    element: containerElement,
    targetState: {
      x,
      y,
      alpha,
      ...getBlurTargetState(nextElement, {
        force: shouldForceBlur,
      }),
    },
    onComplete: () => {
      updateElement();
    },
  });

  if (!dispatched) {
    // No animations, update immediately
    updateElement();
  }
};
