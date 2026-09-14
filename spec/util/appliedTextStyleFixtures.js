import { Text } from "pixi.js";
import applyTextStyle from "../../src/util/applyTextStyle.js";

// Observe real Pixi styles, including defaults after replacing a previous style.
export const observeAppliedTextStyles = (styles) => {
  const text = new Text();
  try {
    return styles.map((style) => {
      applyTextStyle(text, style);
      return {
        letterSpacing: text.style.letterSpacing,
        whiteSpace: text.style.whiteSpace,
      };
    });
  } finally {
    text.destroy();
  }
};
