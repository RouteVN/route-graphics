import { Graphics } from "pixi.js";
import { normalizeVolume } from "../../../util/normalizeVolume.js";
import { dispatchLiveAnimations } from "../../animations/planAnimations.js";
import { setupScrollInteraction } from "./setupScrollInteraction.js";
import { isPrimaryPointerEvent } from "../util/isPrimaryPointerEvent.js";

const normalizeRectFill = (fill) =>
  fill === undefined || fill === null || fill === "" || fill === "transparent"
    ? { color: 0x000000, alpha: 0 }
    : fill;

/**
 * Add rectangle element to the stage (synchronous)
 * @param {import("../elementPlugin.js").AddElementOptions} params
 */
export const addRect = ({
  app,
  parent,
  element,
  animations,
  animationBus,
  eventHandler,
  zIndex,
  completionTracker,
  renderContext,
}) => {
  const { id, x, y, width, height, fill, border, alpha, scaleX, scaleY } =
    element;

  const rect = new Graphics();
  rect.label = id;
  rect.zIndex = zIndex;
  const targetState = { x, y, alpha };

  if (scaleX !== undefined) {
    targetState.scaleX = scaleX;
  }

  if (scaleY !== undefined) {
    targetState.scaleY = scaleY;
  }

  const drawRect = () => {
    rect.clear();
    rect
      .rect(0, 0, Math.round(width), Math.round(height))
      .fill(normalizeRectFill(fill));
    rect.x = Math.round(x);
    rect.y = Math.round(y);
    rect.alpha = alpha;
    // Rect computed nodes already bake scale into width/height for layout.
    // Reset the live transform so update tweens do not double-apply scale.
    rect.scale.x = 1;
    rect.scale.y = 1;

    if (border) {
      rect.stroke({
        color: border.color,
        alpha: border.alpha,
        width: Math.round(border.width),
      });
    }
  };

  drawRect();

  const hoverEvents = element?.hover;
  const clickEvents = element?.click;
  const rightClickEvents = element?.rightClick;
  const scrollUpEvent = element?.scrollUp;
  const scrollDownEvent = element?.scrollDown;
  const dragEvent = element?.drag;

  if (hoverEvents) {
    const { cursor, soundSrc, payload } = hoverEvents;
    rect.eventMode = "static";

    const overListener = () => {
      if (payload && eventHandler)
        eventHandler(`hover`, {
          _event: {
            id: rect.label,
          },
          ...payload,
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
    const { soundSrc, soundVolume, payload } = clickEvents;
    rect.eventMode = "static";

    const releaseListener = (event) => {
      if (!isPrimaryPointerEvent(event)) {
        return;
      }

      if (payload && eventHandler)
        eventHandler(`click`, {
          _event: {
            id: rect.label,
          },
          ...payload,
        });
      if (soundSrc)
        app.audioStage.add({
          id: `click-${Date.now()}`,
          url: soundSrc,
          loop: false,
          volume: normalizeVolume(soundVolume),
        });
    };

    rect.on("pointerup", releaseListener);
  }

  if (rightClickEvents) {
    const { soundSrc, payload } = rightClickEvents;
    rect.eventMode = "static";

    const rightClickListener = () => {
      if (payload && eventHandler)
        eventHandler(`rightClick`, {
          _event: {
            id: rect.label,
          },
          ...payload,
        });
      if (soundSrc)
        app.audioStage.add({
          id: `rightClick-${Date.now()}`,
          url: soundSrc,
          loop: false,
        });
    };

    rect.on("rightclick", rightClickListener);
  }

  if (scrollUpEvent || scrollDownEvent) {
    setupScrollInteraction({
      canvas: app.canvas,
      rect,
      width,
      height,
      scrollUpEvent,
      scrollDownEvent,
      eventHandler,
    });
  }

  if (dragEvent) {
    const { start, end, move } = dragEvent;
    rect.eventMode = "static";

    const downListener = () => {
      rect._isDragging = true;
      if (start && eventHandler) {
        eventHandler("dragStart", {
          _event: {
            id: rect.label,
          },
          ...(typeof start?.payload === "object" ? start.payload : {}),
        });
      }
    };

    const upListener = () => {
      rect._isDragging = false;
      if (end && eventHandler) {
        eventHandler("dragEnd", {
          _event: {
            id: rect.label,
          },
          ...(typeof end?.payload === "object" ? end.payload : {}),
        });
      }
    };

    const moveListener = (e) => {
      if (move && eventHandler && rect._isDragging) {
        eventHandler("dragMove", {
          _event: {
            id: rect.label,
            x: e.global.x,
            y: e.global.y,
          },
          ...(typeof move?.payload === "object" ? move.payload : {}),
        });
      }
    };

    rect.on("pointerdown", downListener);
    rect.on("pointerup", upListener);
    rect.on("globalpointermove", moveListener);
    rect.on("pointerupoutside", upListener);
  }

  parent.addChild(rect);

  dispatchLiveAnimations({
    animations,
    targetId: id,
    animationBus,
    completionTracker,
    element: rect,
    targetState,
    renderContext,
  });
};
