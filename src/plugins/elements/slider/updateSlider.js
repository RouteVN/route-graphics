import { isDeepEqual } from "../../../util/isDeepEqual.js";
import { dispatchLiveAnimations } from "../../animations/planAnimations.js";
import {
  getSliderParts,
  renameSliderParts,
  resizeSliderThumb,
  SLIDER_RUNTIME,
  syncSliderRuntime,
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

      if (bar && thumb) {
        resizeSliderThumb({
          thumb,
          thumbSrc: nextSliderComputedNode.thumbSrc,
          direction: nextSliderComputedNode.direction,
          trackWidth: nextSliderComputedNode.width,
          trackHeight: nextSliderComputedNode.height,
        });
      }

      if (!bar || !thumb) {
        return;
      }

      const shouldAdoptExternalValue =
        sliderElement[SLIDER_RUNTIME]?.isDragging !== true ||
        prevSliderComputedNode.initialValue !==
          nextSliderComputedNode.initialValue;

      syncSliderRuntime({
        app,
        sliderContainer: sliderElement,
        sliderComputedNode: nextSliderComputedNode,
        thumb,
        eventHandler,
        adoptExternalValue: shouldAdoptExternalValue,
      });
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
