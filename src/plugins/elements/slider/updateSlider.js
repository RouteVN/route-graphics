import { isDeepEqual } from "../../../util/isDeepEqual.js";
import { dispatchLiveAnimations } from "../../animations/planAnimations.js";
import {
  applySliderVisualState,
  bindSliderInteractions,
  getSliderParts,
  renameSliderParts,
  resizeSliderThumb,
} from "./sliderRuntime.js";

/**
 * Update slider element
 * @param {import("../elementPlugin").UpdateElementOptions} params
 */
export const updateSlider = ({
  app,
  parent,
  prevElement: prevSliderComputedNode,
  nextElement: nextSliderComputedNode,
  animations,
  animationBus,
  completionTracker,
  eventHandler,
  zIndex,
}) => {
  const sliderElement = parent.children.find(
    (child) => child.label === prevSliderComputedNode.id,
  );

  if (!sliderElement) return;

  sliderElement.zIndex = zIndex;

  const updateElement = () => {
    if (!isDeepEqual(prevSliderComputedNode, nextSliderComputedNode)) {
      // Update container properties
      sliderElement.x = nextSliderComputedNode.x;
      sliderElement.y = nextSliderComputedNode.y;
      sliderElement.alpha = nextSliderComputedNode.alpha;
      sliderElement.label = nextSliderComputedNode.id;
      sliderElement.pivot.set(
        nextSliderComputedNode.originX,
        nextSliderComputedNode.originY,
      );

      renameSliderParts({
        sliderContainer: sliderElement,
        fromId: prevSliderComputedNode.id,
        toId: nextSliderComputedNode.id,
      });

      const { bar, thumb } = getSliderParts({
        sliderContainer: sliderElement,
        id: nextSliderComputedNode.id,
      });

      // Check if handler configuration changed
      const handlerConfigChanged =
        !isDeepEqual(
          prevSliderComputedNode.hover,
          nextSliderComputedNode.hover,
        ) ||
        !isDeepEqual(
          prevSliderComputedNode.change,
          nextSliderComputedNode.change,
        ) ||
        prevSliderComputedNode.min !== nextSliderComputedNode.min ||
        prevSliderComputedNode.max !== nextSliderComputedNode.max ||
        prevSliderComputedNode.step !== nextSliderComputedNode.step ||
        prevSliderComputedNode.direction !== nextSliderComputedNode.direction ||
        prevSliderComputedNode.initialValue !==
          nextSliderComputedNode.initialValue ||
        prevSliderComputedNode.thumbSrc !== nextSliderComputedNode.thumbSrc ||
        prevSliderComputedNode.barSrc !== nextSliderComputedNode.barSrc ||
        prevSliderComputedNode.inactiveBarSrc !==
          nextSliderComputedNode.inactiveBarSrc ||
        prevSliderComputedNode.width !== nextSliderComputedNode.width ||
        prevSliderComputedNode.height !== nextSliderComputedNode.height ||
        prevSliderComputedNode.id !== nextSliderComputedNode.id;

      if (bar && thumb) {
        resizeSliderThumb({
          thumb,
          thumbSrc: nextSliderComputedNode.thumbSrc,
          direction: nextSliderComputedNode.direction,
          trackWidth: nextSliderComputedNode.width,
          trackHeight: nextSliderComputedNode.height,
        });

        applySliderVisualState({
          sliderContainer: sliderElement,
          sliderComputedNode: nextSliderComputedNode,
          thumb,
          currentValue: nextSliderComputedNode.initialValue,
        });
      }

      if (!bar || !thumb) {
        return;
      }

      // Only recreate event handlers if the handler configuration actually changed
      // This prevents unnecessary handler replacement and avoids the "ReferenceError: Can't find variable: id"
      // error that occurs when PixiJS tries to complete pointer events on destroyed closures
      if (handlerConfigChanged) {
        // Remove all existing event listeners from container, bar, and thumb
        sliderElement.removeAllListeners("pointerover");
        sliderElement.removeAllListeners("pointerout");
        sliderElement.removeAllListeners("pointerup");
        sliderElement.removeAllListeners("pointerupoutside");
        sliderElement.removeAllListeners("pointerdown");
        sliderElement.removeAllListeners("globalpointermove");
      }

      // Re-attach event handlers if configuration changed
      if (handlerConfigChanged) {
        bindSliderInteractions({
          app,
          sliderContainer: sliderElement,
          sliderComputedNode: nextSliderComputedNode,
          thumb,
          eventHandler,
        });
      }
    }
  };

  const { x, y, alpha } = nextSliderComputedNode;

  const dispatched = dispatchLiveAnimations({
    animations,
    targetId: prevSliderComputedNode.id,
    animationBus,
    completionTracker,
    element: sliderElement,
    targetState: { x, y, alpha },
    onComplete: updateElement,
  });

  if (!dispatched) {
    // No animations, update immediately
    updateElement();
  }
};
