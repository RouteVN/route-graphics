export const isElementInteractionEnabled = ({ app, element }) =>
  app?.interactionMode !== "design" || element?.designInteraction === true;

export const disableDisplayTreeInteractions = (displayObject) => {
  if (!displayObject) {
    return;
  }

  displayObject.eventMode = "none";
  displayObject.cursor = "auto";

  for (const child of displayObject.children ?? []) {
    disableDisplayTreeInteractions(child);
  }
};
