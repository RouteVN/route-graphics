import { Rectangle } from "pixi.js";

const RECT_SCROLL_HANDLED = "__rtglRectScrollHandled";

/**
 * Attach scroll handling to a rect element with a native canvas fallback.
 * Pixi wheel delivery on Graphics is inconsistent in VT/browser automation,
 * so we also listen on the canvas while the pointer is over the rect.
 *
 * @param {Object} params
 * @param {HTMLCanvasElement | undefined} params.canvas
 * @param {import("pixi.js").Graphics} params.rect
 * @param {number} params.width
 * @param {number} params.height
 * @param {Object | undefined} params.scrollUpEvent
 * @param {Object | undefined} params.scrollDownEvent
 * @param {Function | undefined} params.eventHandler
 */
export const setupScrollInteraction = ({
  canvas,
  rect,
  width,
  height,
  scrollUpEvent,
  scrollDownEvent,
  eventHandler,
}) => {
  if (!scrollUpEvent && !scrollDownEvent) return;

  let isPointerOver = false;

  rect.eventMode = "static";
  rect.hitArea = new Rectangle(0, 0, Math.round(width), Math.round(height));

  const emitScrollEvent = (deltaY, nativeEvent) => {
    if (nativeEvent?.[RECT_SCROLL_HANDLED]) return;
    if (nativeEvent) {
      nativeEvent[RECT_SCROLL_HANDLED] = true;
    }

    if (deltaY < 0 && scrollUpEvent?.payload && eventHandler) {
      eventHandler("scrollUp", {
        _event: {
          id: rect.label,
        },
        ...scrollUpEvent.payload,
      });
    } else if (deltaY > 0 && scrollDownEvent?.payload && eventHandler) {
      eventHandler("scrollDown", {
        _event: {
          id: rect.label,
        },
        ...scrollDownEvent.payload,
      });
    }
  };

  const pointerOverListener = () => {
    isPointerOver = true;
  };

  const pointerOutListener = () => {
    isPointerOver = false;
  };

  const pixiWheelListener = (event) => {
    event.preventDefault?.();
    emitScrollEvent(event.deltaY, event.nativeEvent);
  };

  const nativeWheelListener = (event) => {
    if (!isPointerOver) return;
    event.preventDefault();
    emitScrollEvent(event.deltaY, event);
  };

  rect.on("pointerover", pointerOverListener);
  rect.on("pointerout", pointerOutListener);
  rect.on("wheel", pixiWheelListener);
  canvas?.addEventListener("wheel", nativeWheelListener, { passive: false });

  rect._cleanupScrollInteraction = () => {
    isPointerOver = false;
    rect.off("pointerover", pointerOverListener);
    rect.off("pointerout", pointerOutListener);
    rect.off("wheel", pixiWheelListener);
    canvas?.removeEventListener("wheel", nativeWheelListener);
    rect.hitArea = null;
    delete rect._cleanupScrollInteraction;
  };
};
