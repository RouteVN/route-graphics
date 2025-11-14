import { Sprite, Texture, Container } from "pixi.js";
import animateElements from "../../../util/animateElements";

/**
 * Add slider element to the stage
 * @param {import("../elementPlugin").AddElementOptions} params
 */
export const addSlider = async ({
  app,
  parent,
  element: sliderASTNode,
  animations,
  animationPlugins,
  eventHandler,
  signal,
}) => {
  if (signal?.aborted) {
    return;
  }

  const {
    id,
    x,
    y,
    width,
    height,
    alpha,
    thumbSrc,
    barSrc,
    direction,
    min,
    max,
    step,
    initialValue,
    originX,
    originY,
    hover,
    drag,
    dragStart,
    dragEnd,
  } = sliderASTNode;

  // Create container for the slider
  const sliderContainer = new Container();
  sliderContainer.label = id;
  sliderContainer.x = x;
  sliderContainer.y = y;
  sliderContainer.alpha = alpha;
  sliderContainer.sortableChildren = true;
  sliderContainer.eventMode = "static";
  const barPadding = 0;

  // Create bar sprite
  const barTexture = barSrc ? Texture.from(barSrc) : Texture.EMPTY;
  const bar = new Sprite(barTexture);
  bar.label = `${id}-bar`;
  bar.eventMode = "static";

  // Create thumb sprite
  const thumbTexture = thumbSrc ? Texture.from(thumbSrc) : Texture.EMPTY;
  const thumb = new Sprite(thumbTexture);
  thumb.label = `${id}-thumb`;
  thumb.eventMode = "static";

  // Calculate slider value and thumb position
  let currentValue = initialValue ?? min;
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

  // Setup dimensions and positions
  const setupSlider = () => {
    bar.width = width;
    bar.height = height;

    // Calculate thumb dimensions maintaining aspect ratio with margin
    const maxThumbSize =
      direction === "horizontal"
        ? height - barPadding * 2
        : width - barPadding * 2;

    // Get original texture dimensions
    const thumbTexture = thumbSrc ? Texture.from(thumbSrc) : Texture.EMPTY;
    const originalWidth = thumbTexture.width;
    const originalHeight = thumbTexture.height;

    // Calculate scale to fit within maxThumbSize while maintaining aspect ratio
    const scaleX = maxThumbSize / originalWidth;
    const scaleY = maxThumbSize / originalHeight;
    const scale = Math.min(scaleX, scaleY);

    // Apply scaled dimensions
    thumb.width = originalWidth * scale;
    thumb.height = originalHeight * scale;

    updateThumbPosition(currentValue);
  };

  // Handle cleanup
  signal.addEventListener("abort", setupSlider);
  setupSlider();

  // Store original textures for hover effects
  const originalThumbTexture = thumbTexture;
  const originalBarTexture = barTexture;

  // Dragging state
  let isDragging = false;

  // Calculate value from position
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

    // Apply step if specified
    if (step > 0) {
      newValue = Math.round((newValue - min) / step) * step + min;
      newValue = Math.max(min, Math.min(max, newValue));
    }

    return newValue;
  };

  // Handle drag events
  const dragStartListener = (event) => {
    isDragging = true;

    const newPosition = sliderContainer.toLocal(event.global);
    const newValue = getValueFromPosition(newPosition);

    if (newValue !== currentValue) {
      currentValue = newValue;
      updateThumbPosition(currentValue);

      if (dragStart?.actionPayload) {
        eventHandler(`${id}-drag-start`, {
          _event: { id, value: currentValue },
          ...dragStart.actionPayload,
        });
      }
    }
  };

  const dragMoveListener = (event) => {
    if (!isDragging) return;

    const newPosition = sliderContainer.toLocal(event.global);
    const newValue = getValueFromPosition(newPosition);

    if (newValue !== currentValue) {
      currentValue = newValue;
      updateThumbPosition(currentValue);

      if (drag?.actionPayload) {
        eventHandler(`${id}-drag`, {
          _event: { id, value: currentValue },
          ...drag.actionPayload,
          currentValue,
        });
      }
    }
  };

  const dragEndListener = () => {
    if (isDragging) {
      isDragging = false;

      if (dragEnd?.actionPayload) {
        eventHandler(`${id}-drag-end`, {
          _event: { id, value: currentValue },
          ...dragEnd.actionPayload,
        });
      }
    }
  };

  sliderContainer.on("pointerdown", dragStartListener);
  sliderContainer.on("globalpointermove", dragMoveListener);
  sliderContainer.on("pointerup", dragEndListener);
  sliderContainer.on("pointerupoutside", dragEndListener);

  // Handle hover events
  if (hover) {
    const {
      cursor,
      soundSrc,
      thumbSrc: hoverThumbSrc,
      barSrc: hoverBarSrc,
    } = hover;

    const overListener = () => {
      if (cursor) {
        bar.cursor = cursor;
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
        bar.cursor = "auto";
        thumb.cursor = "auto";

        // Restore original textures
        thumb.texture = originalThumbTexture;
        bar.texture = originalBarTexture;
      }
    };

    // Set container to handle hover events (covers both bar and thumb area)
    sliderContainer.on("pointerover", overListener);
    sliderContainer.on("pointerout", outListener);
    sliderContainer.on("pointerupoutside", outListener);
  }

  // Add sprites to container
  sliderContainer.addChild(bar);
  sliderContainer.addChild(thumb);

  parent.addChild(sliderContainer);

  // Apply animations if any
  if (animations && animations.length > 0) {
    await animateElements(id, animationPlugins, {
      app,
      element: sliderContainer,
      animations,
      signal,
    });
  }
};
