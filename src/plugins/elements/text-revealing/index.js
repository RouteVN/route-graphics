import { createElementPlugin } from "../elementPlugin.js";
import { addTextRevealing } from "./addTextRevealing.js";
import { updateTextRevealing } from "./updateTextRevealing.js";
import { deleteTextRevealing } from "./deleteTextRevealing.js";
import { parseTextRevealing } from "../../parser/textrevealing/parseTextRevealing.js";

// Export the text-revealing plugin
export const textRevealingPlugin = createElementPlugin({
  type: "text-revealing",
  add: addTextRevealing,
  update: updateTextRevealing,
  delete: deleteTextRevealing,
  parse: parseTextRevealing,
});
