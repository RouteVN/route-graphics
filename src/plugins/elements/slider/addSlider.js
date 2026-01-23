import { Sprite, Texture, Container } from "pixi.js";

/**
 * Add slider element to the stage
 * @param {import("../elementPlugin").AddElementOptions} params
 */
export const addSlider = ({
  app,
  parent,
  element: sliderComputedNode,
  animations,
  animationBus,
  completionTracker,
  eventHandler,
  zIndex,
}) => {
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
    hover,
    change,
  } = sliderComputedNode;

  // Create container for the slider
  const sliderContainer = new Container();
  sliderContainer.label = id;
  sliderContainer.zIndex = zIndex;
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

  const onChange = (event) => {
    const newPosition = sliderContainer.toLocal(event.global);
    const newValue = getValueFromPosition(newPosition);

    if (newValue !== currentValue) {
      currentValue = newValue;
      updateThumbPosition(currentValue);

      if (change?.actionPayload && eventHandler) {
        eventHandler("change", {
          _event: { id, value: currentValue },
          ...change.actionPayload,
        });
      }
    }
  };

  // Handle drag events
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

  // Dispatch animations to the bus
  const relevantAnimations = animations?.filter((a) => a.targetId === id) || [];

  for (const animation of relevantAnimations) {
    const stateVersion = completionTracker.getVersion();
    completionTracker.track(stateVersion);

    animationBus.dispatch({
      type: "START",
      payload: {
        id: animation.id,
        element: sliderContainer,
        properties: animation.properties,
        targetState: { x, y, alpha },
        onComplete: () => {
          completionTracker.complete(stateVersion);
        },
      },
    });
  }
};
