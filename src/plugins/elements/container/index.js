import { createElementPlugin } from "../elementPlugin.js";
import { addContainer } from "./addContainer.js";
import { updateContainer } from "./updateContainer.js";
import { deleteContainer } from "./deleteContainer.js";
import { parseContainer } from "./parseContainer.js";
import { shouldUpdateUnchangedShaderFilterProgress } from "../util/shaderFilterEffect.js";
import { hasResumableTextRevealInTree } from "../text-revealing/resumableTree.js";

// Export the container plugin
export const containerPlugin = createElementPlugin({
  type: "container",
  add: addContainer,
  update: updateContainer,
  delete: deleteContainer,
  parse: parseContainer,
  shouldUpdateUnchanged: (options) =>
    shouldUpdateUnchangedShaderFilterProgress(options) ||
    hasResumableTextRevealInTree({
      parent: options.parent,
      elements: [options.nextElement],
    }),
});
