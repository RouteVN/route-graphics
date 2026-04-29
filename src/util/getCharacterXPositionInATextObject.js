import { CanvasTextMetrics } from "pixi.js";

const createMeasurementStyle = (style) => {
  if (!style?.dropShadow || typeof style.clone !== "function") {
    return style;
  }

  const measurementStyle = style.clone();

  measurementStyle.dropShadow = null;

  return measurementStyle;
};

export function getCharacterXPositionInATextObject(textObj, index) {
  const subString = textObj.text.substring(0, index);
  const metrics = CanvasTextMetrics.measureText(
    subString,
    createMeasurementStyle(textObj.style),
  );
  const characterLocalX = metrics.width;
  const characterGlobalX = textObj.x + characterLocalX;

  return characterGlobalX;
}
