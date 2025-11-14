import { createAnimationPlugin } from "../animationPlugin.js";
import { animate } from "./animate.js";

// Export the tween plugin
export const tweenPlugin = createAnimationPlugin({
  type: "tween",
  animate,
});
