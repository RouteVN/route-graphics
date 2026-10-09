// Route Graphics draws a scene to a canvas and never marks a display object
// `accessible`, so Pixi's accessibility layer has nothing to expose. Left on, it
// listens for Tab on the window and for mouse movement on the document, and
// those listeners can outlive the application: after destroy, a Tab press throws
// "Cannot read properties of null (reading 'view')" and the next mouse move
// throws "(reading 'runners')". Turn the whole layer off.
export const PIXI_ACCESSIBILITY_OPTIONS = {
  enabledByDefault: false,
  activateOnTab: false,
  deactivateOnMouseMove: false,
};
