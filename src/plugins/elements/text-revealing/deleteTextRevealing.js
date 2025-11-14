/**
 * Delete text-revealing element
 * @param {import("../elementPlugin").DeleteElementOptions} params
 */
export const deleteTextRevealing = async ({
  parent,
  element,
  signal,
}) => {
  if (signal?.aborted) {
    return;
  }

  const textElement = parent.getChildByLabel(element.id);

  if (textElement) {
    const deleteElement = () => {
      if (textElement && !textElement.destroyed) {
        textElement.destroy({ children: true });
      }
    };

    signal.addEventListener("abort", () => {
      deleteElement();
    });

    deleteElement();
  }
};
