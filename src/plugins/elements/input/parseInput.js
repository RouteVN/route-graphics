import { parseCommonObject } from "../util/parseCommonObject.js";
import {
  DEFAULT_INPUT_BACKGROUND,
  DEFAULT_INPUT_CARET_STYLE,
  DEFAULT_INPUT_FOCUS_RING,
  DEFAULT_INPUT_SELECTION_STYLE,
  resolveInputTextStyle,
  resolvePadding,
} from "./inputShared.js";

export const parseInput = ({ state }) => {
  const computedObj = parseCommonObject(state);
  const value = String(state.value ?? "");
  const placeholder = String(state.placeholder ?? "");

  return {
    ...computedObj,
    value,
    placeholder,
    multiline: state.multiline === true,
    secure: state.secure === true,
    readOnly: state.readOnly === true,
    disabled: state.disabled === true,
    autofocus: state.autofocus === true,
    debugVisible: state.debugVisible === true,
    inputMode: typeof state.inputMode === "string" ? state.inputMode : "text",
    ...(typeof state.maxLength === "number" && {
      maxLength: Math.round(state.maxLength),
    }),
    ...(typeof state.enterKeyHint === "string" && {
      enterKeyHint: state.enterKeyHint,
    }),
    ...(typeof state.tabIndex === "number" && {
      tabIndex: state.tabIndex,
    }),
    textStyle: resolveInputTextStyle(state.textStyle),
    placeholderStyle: resolveInputTextStyle({
      ...state.textStyle,
      fill: "#7A7A7A",
      ...state.placeholderStyle,
    }),
    padding: resolvePadding(state.padding),
    background: {
      ...DEFAULT_INPUT_BACKGROUND,
      ...state.background,
    },
    selectionStyle: {
      ...DEFAULT_INPUT_SELECTION_STYLE,
      ...state.selectionStyle,
    },
    caretStyle: {
      ...DEFAULT_INPUT_CARET_STYLE,
      ...state.caretStyle,
    },
    focusRing: {
      ...DEFAULT_INPUT_FOCUS_RING,
      ...state.focusRing,
    },
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
