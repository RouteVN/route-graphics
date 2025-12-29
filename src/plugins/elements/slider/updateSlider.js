import { Texture } from "pixi.js";
import animateElements from "../../../util/animateElements";

/**
 * Update slider element
 * @param {import("../elementPlugin").UpdateElementOptions} params
 */
export const updateSlider = async ({
  app,
  parent,
  prevElement: prevSliderASTNode,
  nextElement: nextSliderASTNode,
  eventHandler,
  animations,
  animationPlugins,
  signal,
}) => {
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
      sliderElement.label = nextSliderASTNode.id;
      sliderElement.pivot.set(
        nextSliderASTNode.originX,
        nextSliderASTNode.originY,
      );

      // Get bar and thumb sprites
      const bar = sliderElement.getChildByLabel(`${nextSliderASTNode.id}-bar`);
      const thumb = sliderElement.getChildByLabel(
        `${nextSliderASTNode.id}-thumb`,
      );

      if (bar && thumb) {
        // Update bar properties
        bar.width = nextSliderASTNode.width;
        bar.height = nextSliderASTNode.height;

        // Update thumb dimensions maintaining aspect ratio with margin (like renderSlider)
        const barPadding = 0;
        const maxThumbSize =
          nextSliderASTNode.direction === "horizontal"
            ? nextSliderASTNode.height - barPadding * 2
            : nextSliderASTNode.width - barPadding * 2;

        // Get original texture dimensions
        const thumbTexture = nextSliderASTNode.thumbSrc
          ? Texture.from(nextSliderASTNode.thumbSrc)
          : Texture.EMPTY;
        const originalWidth = thumbTexture.width || 16;
        const originalHeight = thumbTexture.height || 16;

        // Calculate scale to fit within maxThumbSize while maintaining aspect ratio
        const scaleX = maxThumbSize / originalWidth;
        const scaleY = maxThumbSize / originalHeight;
        const scale = Math.min(scaleX, scaleY);

        // Apply scaled dimensions
        thumb.width = originalWidth * scale;
        thumb.height = originalHeight * scale;

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
        const normalizedValue =
          (nextSliderASTNode.initialValue - nextSliderASTNode.min) / valueRange;

        if (nextSliderASTNode.direction === "horizontal") {
          thumb.x = normalizedValue * (bar.width - thumb.width);
          thumb.y = (bar.height - thumb.height) / 2;
        } else {
          thumb.x = (bar.width - thumb.width) / 2;
          thumb.y = normalizedValue * (bar.height - thumb.height);
        }
      }

      // Remove all existing event listeners from container, bar, and thumb
      sliderElement.removeAllListeners("pointerover");
      sliderElement.removeAllListeners("pointerout");
      sliderElement.removeAllListeners("pointerup");
      sliderElement.removeAllListeners("pointerupoutside");
      sliderElement.removeAllListeners("pointerdown");
      sliderElement.removeAllListeners("globalpointermove");

      // Re-attach event handlers if they exist
      if (eventHandler) {
        const { hover, change, min, max, step, direction, initialValue } =
          nextSliderASTNode;

        let currentValue = initialValue ?? min;
        const valueRange = max - min;
        sliderElement.eventMode = "static";

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
            normalizedValue = Math.max(
              0,
              Math.min(1, relativeX / (bar.width - thumb.width)),
            );
          } else {
            const relativeY = position.y - thumb.height / 2;
            normalizedValue = Math.max(
              0,
              Math.min(1, relativeY / (bar.height - thumb.height)),
            );
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

        // Handle drag events
        let isDragging = false;

        const onChange = (event) => {
          const newPosition = sliderElement.toLocal(event.global);
          const newValue = getValueFromPosition(newPosition);

          if (newValue !== currentValue) {
            currentValue = newValue;
            updateThumbPosition(currentValue);

            if (change?.actionPayload && eventHandler) {
              eventHandler(`change`, {
                _event: { id, value: currentValue },
                ...change.actionPayload,
              });
            }
          }
        };

        const dragStartListener = (event) => {
          isDragging = true;
          onChange(event);
        };

        const dragMoveListener = (event) => {
          if (isDragging) onChange(event);
        };

        const dragEndListener = () => {
          if (isDragging) isDragging = false;
        };

        sliderElement.on("pointerdown", dragStartListener);
        sliderElement.on("globalpointermove", dragMoveListener);
        sliderElement.on("pointerup", dragEndListener);
        sliderElement.on("pointerupoutside", dragEndListener);

        if (hover) {
          const {
            cursor,
            soundSrc,
            thumbSrc: hoverThumbSrc,
            barSrc: hoverBarSrc,
          } = hover;

          const overListener = () => {
            if (cursor) {
              sliderElement.cursor = cursor;
              thumb.cursor = cursor;
            }
            if (soundSrc)
              app.audioStage.add({
                id: `hover-${Date.now()}`,
                url: soundSrc,
                loop: false,
              });

            // Apply hover textures
            if (hoverThumbSrc) {
              thumb.texture = Texture.from(hoverThumbSrc);
            }
            if (hoverBarSrc) {
              bar.texture = Texture.from(hoverBarSrc);
            }
          };

          const outListener = () => {
            if (!isDragging) {
              sliderElement.cursor = "auto";
              thumb.cursor = "auto";

              // Restore original textures
              thumb.texture = originalThumbTexture;
              bar.texture = originalBarTexture;
            }
          };

          sliderElement.on("pointerover", overListener);
          sliderElement.on("pointerout", outListener);
          sliderElement.on("pointerupoutside", outListener);
        }
      }
    }
  };

  if (sliderElement) {
    if (animations && animations.length > 0) {
      await animateElements(prevSliderASTNode.id, animationPlugins, {
        app,
        element: sliderElement,
        animations,
        signal,
        eventHandler,
      });
    }

    updateElement();
  }
};
