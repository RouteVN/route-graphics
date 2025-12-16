import animateElements from "../../../util/animateElements.js";

/**
 * Update rectangle element
 * @param {import("../elementPlugin.js").UpdateElementOptions} params
 */
export const updateRect = async ({
  app,
  parent,
  prevElement,
  nextElement,
  animations,
  animationPlugins,
  eventHandler,
  signal,
}) => {
  const rectElement = parent.children.find(
    (child) => child.label === prevElement.id,
  );

  let isAnimationDone = true;

  const updateElement = () => {
    if (JSON.stringify(prevElement) !== JSON.stringify(nextElement)) {
      rectElement.clear();

      rectElement
        .rect(
          0,
          0,
          Math.round(nextElement.width),
          Math.round(nextElement.height),
        )
        .fill(nextElement.fill);
      rectElement.x = Math.round(nextElement.x);
      rectElement.y = Math.round(nextElement.y);
      rectElement.alpha = nextElement.alpha;

      if (nextElement.border) {
        rectElement.stroke({
          color: nextElement.border.color,
          alpha: nextElement.border.alpha,
          width: Math.round(nextElement.border.width),
        });
      }

      rectElement.removeAllListeners("pointerover");
      rectElement.removeAllListeners("pointerout");
      rectElement.removeAllListeners("pointerup");
      rectElement.removeAllListeners("rightclick");
      rectElement.removeAllListeners("wheel");
      rectElement.removeAllListeners("pointerdown");
      rectElement.removeAllListeners("globalpointermove");
      rectElement.removeAllListeners("pointerupoutside");

      if (rectElement._cleanupKeyboard) {
        rectElement._cleanupKeyboard();
        rectElement._cleanupKeyboard = null;
      }

      const hoverEvents = nextElement?.hover;
      const clickEvents = nextElement?.click;
      const rightClickEvents = nextElement?.rightClick;
      const scrollEvents = nextElement?.scroll;
      const dragEvents = nextElement?.drag;
      const keyboardEvents = nextElement?.keyboard;

      if (hoverEvents) {
        const { cursor, soundSrc, actionPayload } = hoverEvents;
        rectElement.eventMode = "static";

        const overListener = () => {
          if (actionPayload && eventHandler)
            eventHandler(`hover`, {
              _event: {
                id: rectElement.label,
              },
              ...actionPayload,
            });
          if (cursor) rectElement.cursor = cursor;
          if (soundSrc)
            app.audioStage.add({
              id: `hover-${Date.now()}`,
              url: soundSrc,
              loop: false,
            });
        };

        const outListener = () => {
          rectElement.cursor = "auto";
        };

        rectElement.on("pointerover", overListener);
        rectElement.on("pointerout", outListener);
      }

      if (clickEvents) {
        const { soundSrc, actionPayload } = clickEvents;
        rectElement.eventMode = "static";

        const clickListener = () => {
          if (actionPayload && eventHandler)
            eventHandler(`click`, {
              _event: {
                id: rectElement.label,
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

        rectElement.on("pointerup", clickListener);
      }

      if (rightClickEvents) {
        const { soundSrc, actionPayload } = rightClickEvents;
        rectElement.eventMode = "static";

        const rightClickListener = () => {
          if (actionPayload && eventHandler)
            eventHandler(`rightclick`, {
              _event: {
                id: rectElement.label,
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

        rectElement.on("rightclick", rightClickListener);
      }
      if (scrollEvents) {
        rectElement.eventMode = "static";

        const wheelListener = (e) => {
          if (e.deltaY < 0 && scrollEvents.up) {
            const { actionPayload } = scrollEvents.up;

            if (actionPayload && eventHandler)
              eventHandler(`scrollup`, {
                _event: {
                  id: rectElement.label,
                },
                ...actionPayload,
              });
          } else if (e.deltaY > 0 && scrollEvents.down) {
            const { actionPayload } = scrollEvents.down;

            if (actionPayload && eventHandler)
              eventHandler(`scrolldown`, {
                _event: {
                  id: rectElement.label,
                },
                ...actionPayload,
              });
          }
        };

        rectElement.on("wheel", wheelListener);
      }

      if (dragEvents) {
        const { start, end, move } = dragEvents;
        rectElement.eventMode = "static";

        const downListener = () => {
          rectElement._isDragging = true;
          if (start && eventHandler) {
            eventHandler("drag-start", {
              _event: {
                id: rectElement.label,
              },
              ...(typeof start?.actionPayload === "object"
                ? start.actionPayload
                : {}),
            });
          }
        };

        const upListener = () => {
          rectElement._isDragging = false;
          if (end && eventHandler) {
            eventHandler("drag-end", {
              _event: {
                id: rectElement.label,
              },
              ...(typeof end?.actionPayload === "object"
                ? end.actionPayload
                : {}),
            });
          }
        };

        const moveListener = (e) => {
          if (move && eventHandler && rectElement._isDragging) {
            eventHandler("drag-move", {
              _event: {
                id: rectElement.label,
                x: e.global.x,
                y: e.global.y,
              },
              ...(typeof move?.actionPayload === "object"
                ? move.actionPayload
                : {}),
            });
          }
        };

        rectElement.on("pointerdown", downListener);
        rectElement.on("pointerup", upListener);
        rectElement.on("globalpointermove", moveListener);
        rectElement.on("pointerupoutside", upListener);
      }

      if (keyboardEvents && keyboardEvents.length > 0) {
        rectElement.eventMode = "static";
        let hasFocus = false;

        const keyHandlers = keyboardEvents.map(({ key, actionPayload, soundSrc }) => {
          const handleKey = (e) => {
            // Check if pressed key matches any of the keys in the array
            const keyPressed = e.key.toLowerCase();
            const keysMatch = key.some(k => {
              // Handle special key combinations like ctrl+a
              if (k.includes('+')) {
                const parts = k.split('+');
                const modifier = parts[0].toLowerCase();
                const mainKey = parts[1].toLowerCase();

                if (modifier === 'ctrl' && e.ctrlKey && keyPressed === mainKey) {
                  return true;
                }
                if (modifier === 'shift' && e.shiftKey && keyPressed === mainKey) {
                  return true;
                }
                if (modifier === 'alt' && e.altKey && keyPressed === mainKey) {
                  return true;
                }
                return false;
              }

              // Simple key match
              return k.toLowerCase() === keyPressed;
            });

            if (keysMatch && hasFocus) {
              e.stopPropagation();

              // Play sound if provided
              if (soundSrc) {
                app.audioStage.add({
                  id: `keyboard-${Date.now()}`,
                  url: soundSrc,
                  loop: false,
                });
              }

              if (actionPayload && eventHandler) {
                eventHandler('keyboard', {
                  _event: {
                    id: rectElement.label,
                    key: e.key,
                  },
                  ...actionPayload,
                });
              }
            }
          };

          return handleKey;
        });

        const handleKeyDown = (e) => {
          if(!hasFocus) return;
          keyHandlers.forEach(handler => handler(e));
        };

        const handlePointerDown = () => {
          hasFocus = true;
        };

        const handlePointerDownOutside = () => {
          hasFocus = false;
        };

        window.addEventListener('keydown', handleKeyDown);
        rectElement.on('pointerover', handlePointerDown);
        rectElement.on('pointerout', handlePointerDownOutside);

        const cleanupKeyboard = () => {
          window.removeEventListener('keydown', handleKeyDown);
        };

        rectElement._cleanupKeyboard = cleanupKeyboard;
      }
    }
  };

  const abortHandler = async () => {
    if (!isAnimationDone) {
      updateElement();
    }
  };

  signal.addEventListener("abort", abortHandler);

  if (rectElement) {
    if (animations && animations.length > 0) {
      isAnimationDone = false;
      await animateElements(prevElement.id, animationPlugins, {
        app,
        element: rectElement,
        animations: animations,
        signal,
      });
      isAnimationDone = true;
    }
    updateElement();
    signal.removeEventListener("abort", abortHandler);
  }
};
