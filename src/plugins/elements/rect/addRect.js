import { Graphics } from "pixi.js";

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
}) => {
  const { id, x, y, width, height, fill, border, alpha } = element;

  const rect = new Graphics();
  rect.label = id;
  rect.zIndex = zIndex;

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

  drawRect();

  const hoverEvents = element?.hover;
  const clickEvents = element?.click;
  const rightClickEvents = element?.rightClick;
  const scrollEvents = element?.scroll;
  const dragEvent = element?.drag;

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

  if (rightClickEvents) {
    const { soundSrc, actionPayload } = rightClickEvents;
    rect.eventMode = "static";

    const rightClickListener = () => {
      if (actionPayload && eventHandler)
        eventHandler(`rightclick`, {
          _event: {
            id: rect.label,
          },
          ...actionPayload,
        });
      if (soundSrc)
        app.audioStage.add({
          id: `rightclick-${Date.now()}`,
          url: soundSrc,
          loop: false,
        });
    };

    rect.on("rightclick", rightClickListener);
  }

  if (scrollEvents) {
    rect.eventMode = "static";

    const wheelListener = (e) => {
      if (e.deltaY < 0 && scrollEvents.up) {
        const { actionPayload } = scrollEvents.up;

        if (actionPayload && eventHandler)
          eventHandler(`scrollup`, {
            _event: {
              id: rect.label,
            },
            ...actionPayload,
          });
      } else if (e.deltaY > 0 && scrollEvents.down) {
        const { actionPayload } = scrollEvents.down;

        if (actionPayload && eventHandler)
          eventHandler(`scrolldown`, {
            _event: {
              id: rect.label,
            },
            ...actionPayload,
          });
      }
    };

    rect.on("wheel", wheelListener);
  }

  if (dragEvent) {
    const { start, end, move } = dragEvent;
    rect.eventMode = "static";

    const downListener = () => {
      rect._isDragging = true;
      if (start && eventHandler) {
        eventHandler("drag-start", {
          _event: {
            id: rect.label,
          },
          ...(typeof start?.actionPayload === "object"
            ? start.actionPayload
            : {}),
        });
      }
    };

    const upListener = () => {
      rect._isDragging = false;
      if (end && eventHandler) {
        eventHandler("drag-end", {
          _event: {
            id: rect.label,
          },
          ...(typeof end?.actionPayload === "object" ? end.actionPayload : {}),
        });
      }
    };

    const moveListener = (e) => {
      if (move && eventHandler && rect._isDragging) {
        eventHandler("drag-move", {
          _event: {
            id: rect.label,
            x: e.global.x,
            y: e.global.y,
          },
          ...(typeof move?.actionPayload === "object"
            ? move.actionPayload
            : {}),
        });
      }
    };

    rect.on("pointerdown", downListener);
    rect.on("pointerup", upListener);
    rect.on("globalpointermove", moveListener);
    rect.on("pointerupoutside", upListener);
  }

  parent.addChild(rect);

  // Dispatch animations to the bus
  const relevantAnimations = animations?.filter((a) => a.targetId === id) || [];

  for (const animation of relevantAnimations) {
    const stateVersion = completionTracker.getVersion();
    completionTracker.track(stateVersion);

    animationBus.dispatch({
      type: "START",
      payload: {
        id: animation.id,
        element: rect,
        properties: animation.properties,
        targetState: { x, y, alpha },
        onComplete: () => {
          completionTracker.complete(stateVersion);
        },
      },
    });
  }
};
