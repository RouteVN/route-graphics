import { createElementPlugin } from "../elementPlugin.js";
import { addInput } from "./addInput.js";
import { updateInput } from "./updateInput.js";
import { deleteInput } from "./deleteInput.js";
import { parseInput } from "./parseInput.js";

export const inputPlugin = createElementPlugin({
  type: "input",
  add: addInput,
  update: updateInput,
  delete: deleteInput,
  parse: parseInput,
});

export default inputPlugin;
