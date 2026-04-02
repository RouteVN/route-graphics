import { parseCommonObject } from "../util/parseCommonObject.js";
import { resolveInputTextStyle, resolvePadding } from "./inputShared.js";

export const parseInput = ({ state }) => {
  const computedObj = parseCommonObject(state);
  const value = String(state.value ?? "");
  const placeholder = String(state.placeholder ?? "");

  delete computedObj.originX;
  delete computedObj.originY;

  return {
    ...computedObj,
    value,
    placeholder,
    multiline: state.multiline === true,
    disabled: state.disabled === true,
    ...(typeof state.maxLength === "number" && {
      maxLength: Math.round(state.maxLength),
    }),
    textStyle: resolveInputTextStyle(state.textStyle),
    padding: resolvePadding(state.padding),
    ...(state.change && { change: state.change }),
    ...(state.submit && { submit: state.submit }),
    ...(state.focusEvent && { focusEvent: state.focusEvent }),
    ...(state.blurEvent && { blurEvent: state.blurEvent }),
    ...(state.selectionChange && { selectionChange: state.selectionChange }),
    ...(state.compositionStart && { compositionStart: state.compositionStart }),
    ...(state.compositionUpdate && {
      compositionUpdate: state.compositionUpdate,
    }),
    ...(state.compositionEnd && { compositionEnd: state.compositionEnd }),
  };
};

export default parseInput;
