import { createElementPlugin } from "../elementPlugin.js";
import { addSlider } from "./addSlider.js";
import { updateSlider } from "./updateSlider.js";
import { deleteSlider } from "./deleteSlider.js";
import { parseSlider } from "../../parser/slider/parseSlider.js";

// Export the slider plugin
export const sliderPlugin = createElementPlugin({
  type: "slider",
  add: addSlider,
  update: updateSlider,
  delete: deleteSlider,
  parse: parseSlider,
});
