import { Sprite, Container } from "pixi.js";
import { dispatchLiveAnimations } from "../../animations/planAnimations.js";
import {
  applySliderVisualState,
  bindSliderInteractions,
  getSliderLabels,
  getSliderTexture,
  resizeSliderThumb,
} from "./sliderRuntime.js";

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
  const {
    id,
    x,
    y,
    width,
    height,
    alpha,
    thumbSrc,
    barSrc,
    initialValue,
    min,
  } = sliderComputedNode;

  // Create container for the slider
  const sliderContainer = new Container();
  sliderContainer.label = id;
  sliderContainer.zIndex = zIndex;
  sliderContainer.x = x;
  sliderContainer.y = y;
  sliderContainer.alpha = alpha;
  sliderContainer.sortableChildren = true;
  sliderContainer.eventMode = "static";

  const labels = getSliderLabels(id);

  // Create bar sprite
  const bar = new Sprite(getSliderTexture(barSrc));
  bar.label = labels.bar;
  bar.eventMode = "static";
  bar.zIndex = 1;

  // Create thumb sprite
  const thumb = new Sprite(getSliderTexture(thumbSrc));
  thumb.label = labels.thumb;
  thumb.eventMode = "static";
  thumb.zIndex = 2;

  let currentValue = initialValue ?? min;
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

  applySliderVisualState({
    sliderContainer,
    sliderComputedNode,
    thumb,
    currentValue,
  });

  bindSliderInteractions({
    app,
    sliderContainer,
    sliderComputedNode,
    thumb,
    eventHandler,
  });

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
