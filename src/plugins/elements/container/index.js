import { createElementPlugin } from "../elementPlugin.js";
import { addContainer } from "./addContainer.js";
import { updateContainer } from "./updateContainer.js";
import { deleteContainer } from "./deleteContainer.js";
import { parseContainer } from "../../parser/container/parseContainer.js";

// Export the container plugin
export const containerPlugin = createElementPlugin({
  type: "container",
  add: addContainer,
  update: updateContainer,
  delete: deleteContainer,
  parse: parseContainer,
});
