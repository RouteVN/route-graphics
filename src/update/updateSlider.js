import { Sprite, Texture } from "pixi.js";

/**
 * Update function for Slider elements
 * @typedef {import('../types.js').SliderASTNode} SliderASTNode
 * @typedef {import('pixi.js').Container} Container
 */

/**
 * @param {Object} params
 * @param {import('../types.js').Application} params.app
 * @param {Container} params.parent
 * @param {SliderASTNode} params.prevSliderASTNode
 * @param {SliderASTNode} params.nextSliderASTNode
 * @param {Object[]} params.transitions
 * @param {Function} eventHandler
 * @param {AbortSignal} params.signal
 * @param {Function} params.transitionElements
 */
export async function updateSlider({
  app,
  parent,
  prevSliderASTNode,
  nextSliderASTNode,
  eventHandler,
  transitions,
  transitionElements,
  signal,
}) {
  if (signal?.aborted) {
    return;
  }

  const sliderElement = parent.children.find(
    (child) => child.label === prevSliderASTNode.id,
  );

  const updateElement = () => {
    if (
      JSON.stringify(prevSliderASTNode) !== JSON.stringify(nextSliderASTNode)
    ) {
      // Update container properties
      sliderElement.x = nextSliderASTNode.x;
      sliderElement.y = nextSliderASTNode.y;
      sliderElement.alpha = nextSliderASTNode.alpha;
      sliderElement.zIndex = nextSliderASTNode.zIndex;
      sliderElement.label = nextSliderASTNode.id;
      sliderElement.pivot.set(nextSliderASTNode.originX, nextSliderASTNode.originY);

      // Get bar and thumb sprites
      const bar = sliderElement.getChildByLabel(`${nextSliderASTNode.id}-bar`);
      const thumb = sliderElement.getChildByLabel(`${nextSliderASTNode.id}-thumb`);

      if (bar && thumb) {
        // Update bar properties
        bar.width = nextSliderASTNode.width;
        bar.height = nextSliderASTNode.height;

        // Update thumb dimensions based on direction
        thumb.width = nextSliderASTNode.direction === "horizontal"
          ? nextSliderASTNode.height * 0.8
          : nextSliderASTNode.width * 0.8;
        thumb.height = nextSliderASTNode.direction === "horizontal"
          ? nextSliderASTNode.height * 0.8
          : nextSliderASTNode.width * 0.8;

        // Update textures if they changed
        if (prevSliderASTNode.barSrc !== nextSliderASTNode.barSrc) {
          const barTexture = nextSliderASTNode.barSrc
            ? Texture.from(nextSliderASTNode.barSrc)
            : Texture.EMPTY;
          bar.texture = barTexture;
        }

        if (prevSliderASTNode.thumbSrc !== nextSliderASTNode.thumbSrc) {
          const thumbTexture = nextSliderASTNode.thumbSrc
            ? Texture.from(nextSliderASTNode.thumbSrc)
            : Texture.EMPTY;
          thumb.texture = thumbTexture;
        }

        // Update thumb position based on new value
        const valueRange = nextSliderASTNode.max - nextSliderASTNode.min;
        const normalizedValue = (nextSliderASTNode.initialValue - nextSliderASTNode.min) / valueRange;

        if (nextSliderASTNode.direction === "horizontal") {
          thumb.x = normalizedValue * (bar.width - thumb.width);
          thumb.y = (bar.height - thumb.height) / 2;
        } else {
          thumb.x = (bar.width - thumb.width) / 2;
          thumb.y = normalizedValue * (bar.height - thumb.height);
        }
      }

      // Remove all existing event listeners
      thumb.removeAllListeners("pointerover");
      thumb.removeAllListeners("pointerdown");
      thumb.removeAllListeners("globalpointermove");
      thumb.removeAllListeners("pointerup");
      thumb.removeAllListeners("pointerupoutside");
      thumb.removeAllListeners("pointerupoutside");
      bar.removeAllListeners("pointerdown");

      // Re-attach event handlers if they exist
      if (eventHandler) {
        const {
          hover,
          drag,
          dragStart,
          dragEnd,
          min,
          max,
          step,
          direction,
          initialValue,
        } = nextSliderASTNode;

        let currentValue = initialValue || min;
        const valueRange = max - min;

        const updateThumbPosition = (value) => {
          const normalizedValue = (value - min) / valueRange;
          if (direction === "horizontal") {
            thumb.x = normalizedValue * (bar.width - thumb.width);
            thumb.y = (bar.height - thumb.height) / 2;
          } else {
            thumb.x = (bar.width - thumb.width) / 2;
            thumb.y = normalizedValue * (bar.height - thumb.height);
          }
        };

        const getValueFromPosition = (position) => {
          let normalizedValue;

          if (direction === "horizontal") {
            const relativeX = position.x - thumb.width / 2;
            normalizedValue = Math.max(0, Math.min(1, relativeX / (bar.width - thumb.width)));
          } else {
            const relativeY = position.y - thumb.height / 2;
            normalizedValue = Math.max(0, Math.min(1, relativeY / (bar.height - thumb.height)));
          }

          let newValue = min + normalizedValue * valueRange;

          if (step > 0) {
            newValue = Math.round((newValue - min) / step) * step + min;
            newValue = Math.max(min, Math.min(max, newValue));
          }

          return newValue;
        };

        // Store original textures for hover
        const originalThumbTexture = thumb.texture;
        const originalBarTexture = bar.texture;

        // Handle hover events
        if (hover) {
          const { cursor, soundSrc, actionPayload, thumbSrc: hoverThumbSrc, barSrc: hoverBarSrc } = hover;

          const overListener = () => {
            if (actionPayload)
              eventHandler(`${nextSliderASTNode.id}-pointer-over`, {
                _event: { id: nextSliderASTNode.id },
                ...actionPayload,
              });
            if (cursor) thumb.cursor = cursor;
            if (soundSrc)
              app.audioStage.add({
                id: `hover-${Date.now()}`,
                url: soundSrc,
                loop: false,
              });

            if (hoverThumbSrc) {
              thumb.texture = Texture.from(hoverThumbSrc);
            }
            if (hoverBarSrc) {
              bar.texture = Texture.from(hoverBarSrc);
            }
          };

          const upListener = () => {
            thumb.cursor = "auto";
            thumb.texture = originalThumbTexture;
            bar.texture = originalBarTexture;
          };

          thumb.on("pointerover", overListener);
          thumb.on("pointerup", upListener);
          thumb.on("pointerupoutside", upListener);
        }

        // Handle drag events
        let isDragging = false;

        const dragStartListener = () => {
          isDragging = true;

          if (dragStart?.actionPayload) {
            eventHandler(`${nextSliderASTNode.id}-drag-start`, {
              _event: { id: nextSliderASTNode.id },
              value: currentValue,
              ...dragStart.actionPayload,
            });
          }
        };

        const dragMoveListener = (event) => {
          if (!isDragging) return;

          const newPosition = thumb.parent.toLocal(event.global);
          const newValue = getValueFromPosition(newPosition);

          if (newValue !== currentValue) {
            currentValue = newValue;
            updateThumbPosition(currentValue);

            if (drag?.actionPayload) {
              eventHandler(`${nextSliderASTNode.id}-drag`, {
                _event: { id: nextSliderASTNode.id },
                value: currentValue,
                ...drag.actionPayload,
              });
            }
          }
        };

        const dragEndListener = () => {
          if (isDragging) {
            isDragging = false;

            if (dragEnd?.actionPayload) {
              eventHandler(`${nextSliderASTNode.id}-drag-end`, {
                _event: { id: nextSliderASTNode.id },
                value: currentValue,
                ...dragEnd.actionPayload,
              });
            }
          }
        };

        thumb.on("pointerdown", dragStartListener);
        thumb.on("globalpointermove", dragMoveListener);
        thumb.on("pointerup", dragEndListener);
        thumb.on("pointerupoutside", dragEndListener);
      }
    }
  };

  signal.addEventListener("abort", () => {
    updateElement();
  });

  if (sliderElement) {
    if (transitions && transitions.length > 0) {
      await transitionElements(prevSliderASTNode.id, {
        app,
        sprite: sliderElement,
        transitions,
        signal,
      });
    }

    updateElement();
  }
}