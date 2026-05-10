import { Text } from "pixi.js";
import applyTextStyle from "../../../util/applyTextStyle.js";
import { dispatchLiveAnimations } from "../../animations/planAnimations.js";
import {
  getTextLayoutPosition,
  applyInteractiveTextStyle,
  positionTextInLayoutBox,
  syncTextAnchorRatios,
} from "./textLayout.js";
import { bindTextInteractions } from "./textInteractions.js";
import {
  createRichTextDisplayObject,
  getRichTextLayoutPosition,
  isRichTextComputedNode,
  renderRichTextDisplayObject,
} from "./richTextDisplay.js";

export const getTextAnimationTargetState = (textComputedNode) => ({
  ...(isRichTextComputedNode(textComputedNode)
    ? getRichTextLayoutPosition(textComputedNode)
    : getTextLayoutPosition(textComputedNode)),
  alpha: textComputedNode.alpha,
});

export const createTextDisplayObject = (textComputedNode, zIndex) => {
  if (isRichTextComputedNode(textComputedNode)) {
    return createRichTextDisplayObject(textComputedNode, zIndex);
  }

  const text = new Text({
    label: textComputedNode.id,
  });

  text.zIndex = zIndex;
  text.text = textComputedNode.content;
  applyTextStyle(text, textComputedNode.textStyle);
  syncTextAnchorRatios(text, textComputedNode);
  text.alpha = textComputedNode.alpha;
  positionTextInLayoutBox(text, textComputedNode);

  return text;
};

export const applyTextDisplayStyle = (
  displayObject,
  textComputedNode,
  overrideStyle,
) => {
  if (isRichTextComputedNode(textComputedNode)) {
    renderRichTextDisplayObject(displayObject, textComputedNode, overrideStyle);
    return;
  }

  applyInteractiveTextStyle(
    displayObject,
    textComputedNode.textStyle,
    overrideStyle,
  );
};

/**
 * Add text element to the stage (synchronous)
 * @param {import("../elementPlugin.js").AddElementOptions} params
 */
export const addText = ({
  app,
  parent,
  element: textComputedNode,
  animations,
  eventHandler,
  animationBus,
  completionTracker,
  renderContext,
  zIndex,
}) => {
  const text = createTextDisplayObject(textComputedNode, zIndex);

  bindTextInteractions({
    app,
    displayObject: text,
    textComputedNode,
    eventHandler,
    applyStyle: (overrideStyle) =>
      applyTextDisplayStyle(text, textComputedNode, overrideStyle),
  });

  parent.addChild(text);

  dispatchLiveAnimations({
    animations,
    targetId: textComputedNode.id,
    animationBus,
    completionTracker,
    element: text,
    targetState: getTextAnimationTargetState(textComputedNode),
    renderContext,
  });
};
