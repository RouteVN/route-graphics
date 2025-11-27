import animateElements from "../../../util/animateElements";

/**
 * Delete container element
 * @param {import("../elementPlugin").DeleteElementOptions} params
 */
export const deleteContainer = async ({
  app,
  parent,
  element,
  animationPlugins,
  animations,
  signal,
}) => {

  const containerElement = parent.getChildByLabel(element.id);

  if (containerElement) {
    const deleteElement = () => {
      if (containerElement && !containerElement.destroyed) {
        console.log("Container being destroyed ",containerElement)
        console.log("Parent container before destorying ", (parent))
        parent.removeChild(containerElement);
        containerElement.destroy({children:true, texture:true, baseTexture:true});
        console.log("Delete contaienr: ",element)
        console.log("Stage after deleting container", parent)
      }
    };

    signal.addEventListener("abort", () => {
      deleteElement();
    });

    if (animations && animations.length > 0) {
      await animateElements(element.id, animationPlugins, {
        app,
        element: containerElement,
        animations,
        signal,
      });
    }
    deleteElement();
  }
};
