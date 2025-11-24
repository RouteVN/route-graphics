import { createElementPlugin } from "../elementPlugin.js";
import { addGif } from "./addGif.js";
import { updateGif } from "./updateGif.js";
import { deleteGif } from "./deleteGif.js";

export const gifPlugin = createElementPlugin({
  type: "gif",
  add: addGif,
  update: updateGif,
  delete: deleteGif,
});
