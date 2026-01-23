/**
 * Delete text-revealing element
 * @param {import("../elementPlugin").DeleteElementOptions} params
 */
export const deleteTextRevealing = ({ parent, element }) => {
  const textElement = parent.getChildByLabel(element.id);

  if (textElement && !textElement.destroyed) {
    textElement.destroy({ children: true });
  }
};
