import { abortRevealingLoop } from "./abortRevealingLoop";

/**
 * Delete text-revealing element
 * @param {import("../elementPlugin").DeleteElementOptions} params
 */
export const deleteTextRevealing = ({ parent, element }) => {
  abortRevealingLoop(parent, element.id, { createNew: false });

  const textElement = parent.getChildByLabel(element.id);

  if (textElement && !textElement.destroyed) {
    textElement.destroy({ children: true });
  }
};
