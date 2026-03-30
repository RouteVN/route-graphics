import { Graphics, Sprite, Texture } from "pixi.js";

const BAR_PADDING = 0;
const DEFAULT_TEXTURE_SIZE = 16;

const hasOwn = (object, key) =>
  object !== null &&
  typeof object === "object" &&
  Object.prototype.hasOwnProperty.call(object, key);

const clamp01 = (value) => Math.max(0, Math.min(1, value));

export const getSliderTexture = (src) =>
  src ? Texture.from(src) : Texture.EMPTY;

export const getSliderLabels = (id) => ({
  bar: `${id}-bar`,
  inactiveBar: `${id}-inactive-bar`,
  barMask: `${id}-bar-mask`,
  thumb: `${id}-thumb`,
});

export const renameSliderParts = ({ sliderContainer, fromId, toId }) => {
  if (fromId === toId) return;

  const previousLabels = getSliderLabels(fromId);
  const nextLabels = getSliderLabels(toId);

  for (const [part, previousLabel] of Object.entries(previousLabels)) {
    const child = sliderContainer.getChildByLabel(previousLabel);

    if (child) {
      child.label = nextLabels[part];
    }
  }
};

export const getSliderParts = ({ sliderContainer, id }) => {
  const labels = getSliderLabels(id);

  return {
    bar: sliderContainer.getChildByLabel(labels.bar),
    inactiveBar: sliderContainer.getChildByLabel(labels.inactiveBar),
    barMask: sliderContainer.getChildByLabel(labels.barMask),
    thumb: sliderContainer.getChildByLabel(labels.thumb),
  };
};

const resolveVisualSource = ({ baseValue, override, key }) =>
  hasOwn(override, key) ? (override[key] ?? "") : (baseValue ?? "");

const getSliderVisualSources = (sliderComputedNode, hoverOverride = null) => ({
  thumbSrc: resolveVisualSource({
    baseValue: sliderComputedNode.thumbSrc,
    override: hoverOverride,
    key: "thumbSrc",
  }),
  barSrc: resolveVisualSource({
    baseValue: sliderComputedNode.barSrc,
    override: hoverOverride,
    key: "barSrc",
  }),
  inactiveBarSrc: resolveVisualSource({
    baseValue: sliderComputedNode.inactiveBarSrc,
    override: hoverOverride,
    key: "inactiveBarSrc",
  }),
});

const createInactiveBar = (label) => {
  const inactiveBar = new Sprite(Texture.EMPTY);
  inactiveBar.label = label;
  inactiveBar.eventMode = "static";
  inactiveBar.zIndex = 0;
  return inactiveBar;
};

const createBarMask = (label) => {
  const barMask = new Graphics();
  barMask.label = label;
  barMask.zIndex = 0;
  return barMask;
};

const ensureSplitTrack = ({ sliderContainer, id, bar }) => {
  const labels = getSliderLabels(id);
  let { inactiveBar, barMask } = getSliderParts({ sliderContainer, id });

  if (!inactiveBar) {
    inactiveBar = createInactiveBar(labels.inactiveBar);
    sliderContainer.addChild(inactiveBar);
  }

  if (!barMask) {
    barMask = createBarMask(labels.barMask);
    sliderContainer.addChild(barMask);
  }

  bar.mask = barMask;

  return { inactiveBar, barMask };
};

const removeSplitTrack = ({ sliderContainer, id, bar }) => {
  const { inactiveBar, barMask } = getSliderParts({ sliderContainer, id });

  if (bar?.mask === barMask) {
    bar.mask = null;
  }

  if (inactiveBar) {
    sliderContainer.removeChild(inactiveBar);
    inactiveBar.destroy();
  }

  if (barMask) {
    sliderContainer.removeChild(barMask);
    barMask.destroy();
  }
};

const getNormalizedValue = ({ currentValue, min, max }) => {
  const valueRange = max - min;

  if (valueRange <= 0) {
    return 0;
  }

  return clamp01((currentValue - min) / valueRange);
};

const updateBarMask = ({
  barMask,
  direction,
  width,
  height,
  currentValue,
  min,
  max,
}) => {
  if (!barMask) return;

  const normalizedValue = getNormalizedValue({ currentValue, min, max });
  const revealWidth =
    direction === "horizontal"
      ? Math.round(width * normalizedValue)
      : Math.round(width);
  const revealHeight =
    direction === "horizontal"
      ? Math.round(height)
      : Math.round(height * normalizedValue);

  barMask.clear();

  if (revealWidth <= 0 || revealHeight <= 0) {
    return;
  }

  barMask.rect(0, 0, revealWidth, revealHeight).fill({
    color: 0xffffff,
    alpha: 0,
  });
};

export const updateThumbPosition = ({
  thumb,
  direction,
  currentValue,
  min,
  max,
  trackWidth,
  trackHeight,
}) => {
  const normalizedValue = getNormalizedValue({ currentValue, min, max });

  if (direction === "horizontal") {
    thumb.x = normalizedValue * (trackWidth - thumb.width);
    thumb.y = (trackHeight - thumb.height) / 2;
    return;
  }

  thumb.x = (trackWidth - thumb.width) / 2;
  thumb.y = normalizedValue * (trackHeight - thumb.height);
};

export const resizeSliderThumb = ({
  thumb,
  thumbSrc,
  direction,
  trackWidth,
  trackHeight,
}) => {
  const maxThumbSize =
    direction === "horizontal"
      ? trackHeight - BAR_PADDING * 2
      : trackWidth - BAR_PADDING * 2;

  const thumbTexture = getSliderTexture(thumbSrc);
  const originalWidth = thumbTexture.width || DEFAULT_TEXTURE_SIZE;
  const originalHeight = thumbTexture.height || DEFAULT_TEXTURE_SIZE;
  const scaleX = maxThumbSize / originalWidth;
  const scaleY = maxThumbSize / originalHeight;
  const scale = Math.min(scaleX, scaleY);

  thumb.width = originalWidth * scale;
  thumb.height = originalHeight * scale;
};

export const applySliderVisualState = ({
  sliderContainer,
  sliderComputedNode,
  thumb,
  currentValue,
  hoverOverride = null,
}) => {
  const { id, width, height, direction, min, max } = sliderComputedNode;
  const { barSrc, inactiveBarSrc, thumbSrc } = getSliderVisualSources(
    sliderComputedNode,
    hoverOverride,
  );
  let { bar } = getSliderParts({ sliderContainer, id });

  if (!bar) {
    return;
  }

  bar.texture = getSliderTexture(barSrc);
  bar.width = width;
  bar.height = height;
  thumb.texture = getSliderTexture(thumbSrc);

  if (inactiveBarSrc) {
    const { inactiveBar, barMask } = ensureSplitTrack({
      sliderContainer,
      id,
      bar,
    });

    inactiveBar.texture = getSliderTexture(inactiveBarSrc);
    inactiveBar.width = width;
    inactiveBar.height = height;

    updateBarMask({
      barMask,
      direction,
      width,
      height,
      currentValue,
      min,
      max,
    });
  } else {
    removeSplitTrack({ sliderContainer, id, bar });
  }

  updateThumbPosition({
    thumb,
    direction,
    currentValue,
    min,
    max,
    trackWidth: width,
    trackHeight: height,
  });
};

export const getSliderValueFromPosition = ({
  position,
  thumb,
  direction,
  min,
  max,
  step,
  trackWidth,
  trackHeight,
}) => {
  const valueRange = max - min;
  let normalizedValue;

  if (direction === "horizontal") {
    const relativeX = position.x - thumb.width / 2;
    const denominator = Math.max(trackWidth - thumb.width, 1);
    normalizedValue = clamp01(relativeX / denominator);
  } else {
    const relativeY = position.y - thumb.height / 2;
    const denominator = Math.max(trackHeight - thumb.height, 1);
    normalizedValue = clamp01(relativeY / denominator);
  }

  let newValue = min + normalizedValue * valueRange;

  if (step > 0) {
    newValue = Math.round((newValue - min) / step) * step + min;
    newValue = Math.max(min, Math.min(max, newValue));
  }

  return newValue;
};

const setSliderCursor = ({ sliderContainer, sliderComputedNode, cursor }) => {
  const nextCursor = cursor ?? "auto";
  const { bar, inactiveBar, thumb } = getSliderParts({
    sliderContainer,
    id: sliderComputedNode.id,
  });

  sliderContainer.cursor = nextCursor;

  if (bar) {
    bar.cursor = nextCursor;
  }

  if (inactiveBar) {
    inactiveBar.cursor = nextCursor;
  }

  if (thumb) {
    thumb.cursor = nextCursor;
  }
};

export const bindSliderInteractions = ({
  app,
  sliderContainer,
  sliderComputedNode,
  thumb,
  eventHandler,
}) => {
  const {
    id,
    hover,
    change,
    min,
    max,
    step,
    direction,
    initialValue,
    width,
    height,
  } = sliderComputedNode;
  let currentValue = initialValue ?? min;
  let isDragging = false;
  let isHovered = false;

  const applyCurrentVisualState = () => {
    applySliderVisualState({
      sliderContainer,
      sliderComputedNode,
      thumb,
      currentValue,
      hoverOverride: isHovered ? hover : null,
    });
  };

  const onChange = (event) => {
    const newPosition = sliderContainer.toLocal(event.global);
    const newValue = getSliderValueFromPosition({
      position: newPosition,
      thumb,
      direction,
      min,
      max,
      step,
      trackWidth: width,
      trackHeight: height,
    });

    if (newValue !== currentValue) {
      currentValue = newValue;
      applyCurrentVisualState();

      if (change?.payload && eventHandler) {
        eventHandler("change", {
          _event: { id, value: currentValue },
          ...change.payload,
        });
      }
    }
  };

  const dragStartListener = (event) => {
    isDragging = true;
    onChange(event);
  };

  const dragMoveListener = (event) => {
    if (isDragging) {
      onChange(event);
    }
  };

  const dragEndListener = () => {
    if (isDragging) {
      isDragging = false;
    }
  };

  sliderContainer.on("pointerdown", dragStartListener);
  sliderContainer.on("globalpointermove", dragMoveListener);
  sliderContainer.on("pointerup", dragEndListener);
  sliderContainer.on("pointerupoutside", dragEndListener);

  if (!hover) {
    return;
  }

  const overListener = () => {
    isHovered = true;
    applyCurrentVisualState();
    setSliderCursor({
      sliderContainer,
      sliderComputedNode,
      cursor: hover.cursor,
    });

    if (hover.soundSrc) {
      app.audioStage.add({
        id: `hover-${Date.now()}`,
        url: hover.soundSrc,
        loop: false,
      });
    }
  };

  const outListener = () => {
    if (isDragging) {
      return;
    }

    isHovered = false;
    applyCurrentVisualState();
    setSliderCursor({ sliderContainer, sliderComputedNode, cursor: null });
  };

  sliderContainer.on("pointerover", overListener);
  sliderContainer.on("pointerout", outListener);
  sliderContainer.on("pointerupoutside", outListener);
};
