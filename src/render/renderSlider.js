import { Sprite, Texture, Container } from "pixi.js";

/**
 * @param {Object} params
 * @param {import('../types.js').Application} params.app
 * @param {import('../types.js').Container} params.parent
 * @property {SliderASTNode} sliderASTNode
 * @param {Object[]} params.transitions
 * @param {AbortSignal} params.signal
 * @param {Function} params.eventHandler
 * @param {Function} params.transitionElements
 */
export async function renderSlider({
  app,
  parent,
  sliderASTNode,
  transitions,
  eventHandler,
  transitionElements,
  signal,
}) {
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
    zIndex,
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
  sliderContainer.zIndex = zIndex;
  sliderContainer.sortableChildren = true;

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

    thumb.width = direction === "horizontal" ? height - 4 * 2 : width - 4 * 2;
    thumb.height = direction === "horizontal" ? height - 4 * 2 : width - 4 * 2;

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

  // Handle hover events
  if (eventHandler && hover) {
    const {
      cursor,
      soundSrc,
      actionPayload,
      thumbSrc: hoverThumbSrc,
      barSrc: hoverBarSrc,
    } = hover;

    const overListener = () => {
      if (actionPayload)
        eventHandler(`${id}-pointer-over`, {
          _event: { id },
          ...actionPayload,
        });
      if (cursor) thumb.cursor = cursor;
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
      thumb.cursor = "auto";

      // Restore original textures
      thumb.texture = originalThumbTexture;
      bar.texture = originalBarTexture;
    };

    thumb.on("pointerover", overListener);
    thumb.on("pointerout", outListener);
  }

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

  const barClickListener = (event) => {
    const clickPosition = sliderContainer.toLocal(event.global);
    const newValue = getValueFromPosition(clickPosition);

    if (newValue !== currentValue) {
      currentValue = newValue;
      updateThumbPosition(currentValue);

      // Trigger drag events for immediate value change
      if (dragStart?.actionPayload) {
        eventHandler(`${id}-drag-start`, {
          _event: { id },
          value: currentValue,
          ...dragStart.actionPayload,
        });
      }

      if (drag?.actionPayload) {
        eventHandler(`${id}-drag`, {
          _event: { id },
          value: currentValue,
          ...drag.actionPayload,
          currentValue,
        });
      }
    }
  };

  bar.on("pointerdown", barClickListener);

  // Handle drag events
  const dragStartListener = (event) => {
    isDragging = true;

    if (dragStart?.actionPayload) {
      eventHandler(`${id}-drag-start`, {
        _event: { id },
        value: currentValue,
        ...dragStart.actionPayload,
      });
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
          _event: { id },
          value: currentValue,
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
          _event: { id },
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

  // Add sprites to container
  sliderContainer.addChild(bar);
  sliderContainer.addChild(thumb);

  parent.addChild(sliderContainer);

  // Apply transitions if any
  if (transitions && transitions.length > 0) {
    await transitionElements(id, {
      app,
      sprite: sliderContainer,
      transitions,
      signal,
    });
  }
}
