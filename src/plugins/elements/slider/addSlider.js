import { Sprite, Container } from "pixi.js";
import { dispatchLiveAnimations } from "../../animations/planAnimations.js";
import {
  bindSliderInteractions,
  getSliderLabels,
  getSliderTexture,
  resizeSliderThumb,
  syncSliderRuntime,
} from "./sliderRuntime.js";
import {
  disableDisplayTreeInteractions,
  isElementInteractionEnabled,
} from "../../../util/isElementInteractionEnabled.js";

/**
 * Add slider element to the stage
 * @param {import("../elementPlugin").AddElementOptions} params
 */
export const addSlider = ({
  app,
  parent,
  element: sliderComputedNode,
  animations,
  animationBus,
  completionTracker,
  eventHandler,
  renderContext,
  zIndex,
}) => {
  const { id, x, y, width, height, alpha, thumbSrc, barSrc } =
    sliderComputedNode;
  const interactionsEnabled = isElementInteractionEnabled({
    app,
    element: sliderComputedNode,
  });

  // Create container for the slider
  const sliderContainer = new Container();
  sliderContainer.label = id;
  sliderContainer.zIndex = zIndex;
  sliderContainer.x = x;
  sliderContainer.y = y;
  sliderContainer.alpha = alpha;
  sliderContainer.sortableChildren = true;
  sliderContainer.eventMode = interactionsEnabled ? "static" : "none";

  const labels = getSliderLabels(id);

  // Create bar sprite
  const bar = new Sprite(getSliderTexture(barSrc));
  bar.label = labels.bar;
  bar.eventMode = interactionsEnabled ? "static" : "none";
  bar.zIndex = 1;

  // Create thumb sprite
  const thumb = new Sprite(getSliderTexture(thumbSrc));
  thumb.label = labels.thumb;
  thumb.eventMode = interactionsEnabled ? "static" : "none";
  thumb.zIndex = 2;

  resizeSliderThumb({
    thumb,
    thumbSrc,
    direction: sliderComputedNode.direction,
    trackWidth: width,
    trackHeight: height,
  });

  // Add sprites to container
  sliderContainer.addChild(bar);
  sliderContainer.addChild(thumb);

  if (interactionsEnabled) {
    bindSliderInteractions({
      app,
      sliderContainer,
      sliderComputedNode,
      thumb,
      eventHandler,
    });
  }

  syncSliderRuntime({
    app,
    sliderContainer,
    sliderComputedNode,
    thumb,
    eventHandler,
  });

  if (!interactionsEnabled) {
    disableDisplayTreeInteractions(sliderContainer);
  }

  parent.addChild(sliderContainer);

  dispatchLiveAnimations({
    animations,
    targetId: id,
    animationBus,
    completionTracker,
    element: sliderContainer,
    targetState: { x, y, alpha },
    renderContext,
  });
};
