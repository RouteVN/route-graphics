/**
 * @readonly
 * @enum {string}
 */
export const WhiteListTransitionProps = {
  alpha: "alpha",
  x: "x",
  y: "y",
  scaleX: "scaleX",
  scaleY: "scaleY",
  rotation: "rotation",
};

/**
 * @readonly
 * @enum {string[]}
 */
export const TRANSITION_PROPERTY_PATH_MAP = {
  scaleX: ["scale", "x"],
  scaleY: ["scale", "y"],
  x: ["x"],
  y: ["y"],
  alpha: ["alpha"],
  rotation: ["rotation"],
};

/**
 * @readonly
 * @enum {string}
 */
export const TransitionEvent = {
  Add: "add",
  Remove: "remove",
  Update: "update",
};

/**
 * @readonly
 * @enum {string}
 */
export const ComputedNodeType = {
  RECT: "rect",
  TEXT: "text",
  CONTAINER: "container",
  SPRITE: "sprite",
  TEXT_REVEALING: "text-revealing",
  SLIDER: "slider",
  PARTICLES: "particles",
  ANIMATED_SPRITE: "animated-sprite",
  VIDEO: "video",
};

/**
 * @readonly
 * @enum {string}
 */
export const AudioType = {
  SOUND: "sound",
};

/**
 * Default text style configuration
 * @readonly
 * @type {import('pixi.js').TextStyleOptions}
 */
export const DEFAULT_TEXT_STYLE = {
  fill: "black",
  fontFamily: "Arial",
  fontSize: 16,
  align: "left",
  lineHeight: 1.2,
  wordWrap: false,
  breakWords: false,
  strokeColor: "transparent",
  strokeWidth: 0,
  wordWrapWidth: 0,
};
