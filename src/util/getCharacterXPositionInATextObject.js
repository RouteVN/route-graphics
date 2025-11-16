import { CanvasTextMetrics } from "pixi.js";

export function getCharacterXPositionInATextObject(textObj, index) {
  const subString = textObj.text.substring(0, index);
  const metrics = CanvasTextMetrics.measureText(subString, textObj.style);
  const characterLocalX = metrics.width;
  const characterGlobalX = textObj.x + characterLocalX;

  return characterGlobalX;
}
