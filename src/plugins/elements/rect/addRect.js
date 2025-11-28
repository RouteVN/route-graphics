import animateElements from "../../../util/animateElements.js";
import { Graphics } from "pixi.js";

/**
 * Add rectangle element to the stage
 * @param {import("../elementPlugin.js").AddElementOptions} params
 */
export const addRect = async ({
  app,
  parent,
  element,
  animations,
  animationPlugins,
  eventHandler,
  signal,
}) => {
  const {
    id,
    x,
    y,
    width,
    height,
    fill,
    border,
    originX,
    originY,
    rotation,
    alpha,
  } = element;

  const rect = new Graphics();
  rect.label = id;
  let isAnimationDone = true;

  const drawRect = () => {
    rect.clear();
    rect.rect(0, 0, Math.round(width), Math.round(height)).fill(fill);
    rect.x = Math.round(x);
    rect.y = Math.round(y);
    rect.alpha = alpha;

    if (border) {
      rect.stroke({
        color: border.color,
        alpha: border.alpha,
        width: Math.round(border.width),
      });
    }
  };

  const abortHandler = async () => {
    if (!isAnimationDone) {
      drawRect();
    }
  };

  signal.addEventListener("abort", abortHandler);
  drawRect();

  const hoverEvents = element?.hover;
  const clickEvents = element?.click;
  const dragEvent = element.drag;

  if (hoverEvents) {
    const { cursor, soundSrc, actionPayload } = hoverEvents;
    rect.eventMode = "static";

    const overListener = () => {
      if (actionPayload && eventHandler)
        eventHandler(`hover`, {
          _event: {
            id: rect.label,
          },
          ...actionPayload,
        });
      if (cursor) rect.cursor = cursor;
      if (soundSrc)
        app.audioStage.add({
          id: `hover-${Date.now()}`,
          url: soundSrc,
          loop: false,
        });
    };

    const outListener = () => {
      rect.cursor = "auto";
    };

    rect.on("pointerover", overListener);
    rect.on("pointerout", outListener);
  }

  if (clickEvents) {
    const { soundSrc, actionPayload } = clickEvents;
    rect.eventMode = "static";

    const releaseListener = () => {
      if (actionPayload && eventHandler)
        eventHandler(`click`, {
          _event: {
            id: rect.label,
          },
          ...actionPayload,
        });
      if (soundSrc)
        app.audioStage.add({
          id: `click-${Date.now()}`,
          url: soundSrc,
          loop: false,
        });
    };

    rect.on("pointerup", releaseListener);
  }

  if(dragEvent){
    const { down, up, move } = dragEvent;

    const downListener = () =>{
      if(down?.actionPayload && eventHandler){
        eventHandler("drag-down",{
          _event:{
            id: rect.label,
          },
          ...down?.actionPayload,
        })
      }
    }

    const upListener = () =>{
      if(up?.actionPayload && eventHandler){
        eventHandler("drag-up",{
          _event:{
            id: rect.label,
          },
          ...up?.actionPayload,
        })
      }
    }

    const moveListener = () =>{
      if(move?.actionPayload && eventHandler){
        eventHandler("drag-move",{
          _event:{
            id: rect.label,
          },
          ...move?.actionPayload,
        })
      }
    }

    rect.on("pointerup",downListener);
    rect.on("pointerdown",upListener);
    rect.on("pointermove",moveListener);
  }

  parent.addChild(rect);

  if (animations && animations.length > 0) {
    isAnimationDone = false;
    await animateElements(id, animationPlugins, {
      app,
      element: rect,
      animations,
      signal,
    });
  }
  isAnimationDone = true;

  signal.removeEventListener("abort", abortHandler);
};
