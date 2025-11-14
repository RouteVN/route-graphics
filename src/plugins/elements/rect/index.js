import { createElementPlugin } from "../elementPlugin.js";
import { addRect } from "./addRect.js";
import { updateRect } from "./updateRect.js";
import { deleteRect } from "./deleteRect.js";

// Export the rect plugin
export const rectPlugin = createElementPlugin({
  type: "rect",
  add: addRect,
  update: updateRect,
  delete: deleteRect,
});
