/**
 * Delete text-revealing element
 * @param {import("../elementPlugin").DeleteElementOptions} params
 */
export const deleteTextRevealing = async ({ parent, element, signal }) => {
  if (signal?.aborted) {
    return;
  }

  const textElement = parent.getChildByLabel(element.id);

  if (textElement) {
    let isAnimationDone = true;

    const deleteElement = () => {
      if (textElement && !textElement.destroyed) {
        textElement.destroy({ children: true });
      }
    };

    const abortHandler = async () => {
      if(!isAnimationDone){
        deleteElement();
      }
    };

    signal.addEventListener("abort", abortHandler);

    deleteElement();
    signal.removeEventListener("abort", abortHandler);
  }
};
