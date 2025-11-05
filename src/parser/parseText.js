import { CanvasTextMetrics, TextStyle } from 'pixi.js';
import { parseCommonObject } from './parseCommonObject.js';

/**
 * @typedef {import('../types.js').BaseElement} BaseElement
 * @typedef {import('../types.js').TextASTNode} TextASTNode
 */

/**
 * Parse text object and calculate final position after anchor adjustment
 * @param {BaseElement} state
 * @returns {TextASTNode}
 */
export function parseText(state) {
  const defaultTextStyle = {
    fill: 'black',
    fontFamily: 'Arial',
    fontSize: 16,
  }

  const textStyle = {
    ...defaultTextStyle,
    ...state.style,
  }

  if (state.width) {
    textStyle.wordWrapWidth = state.width
    textStyle.wordWrap = true
  }

  const { width, height } = CanvasTextMetrics.measureText(state.text, new TextStyle(textStyle));

  let astObj = parseCommonObject({ ...state, width, height })

  if(state?.hover?.textStyle){
    astObj.hover.textStyle = state.hover.textStyle
  }

  if(state?.click?.textStyle){
    astObj.click.textStyle = state.hover.textStyle
  }

  return {
    ...astObj,
    text: state.text ?? "",
    style: {
      ...textStyle
    },
  };
}

