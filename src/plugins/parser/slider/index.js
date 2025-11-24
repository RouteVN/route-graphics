import { parseSlider } from "./parseSlider.js";
import { createParserPlugin } from "../parserPlugin.js";

export const parseSliderPlugin = createParserPlugin({
  type: "slider",
  parse: parseSlider,
});
