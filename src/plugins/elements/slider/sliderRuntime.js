import { Graphics, Sprite, Texture } from "pixi.js";
import {
  clearInheritedHoverTarget,
  createHoverStateController,
} from "../util/hoverInheritance.js";

const BAR_PADDING = 0;
const DEFAULT_TEXTURE_SIZE = 16;
export const SLIDER_RUNTIME = Symbol("routeGraphicsSliderRuntime");

const hasOwn = (object, key) =>
  object !== null &&
  typeof object === "object" &&
  Object.prototype.hasOwnProperty.call(object, key);

const clamp01 = (value) => Math.max(0, Math.min(1, value));

const getInitialSliderValue = (sliderComputedNode) =>
  sliderComputedNode.initialValue ?? sliderComputedNode.min;

const readPointerId = (event) => {
  if (!event || typeof event !== "object") {
    return undefined;
  }

  if (typeof event.pointerId === "number") {
    return event.pointerId;
  }

  if (typeof event.nativeEvent?.pointerId === "number") {
    return event.nativeEvent.pointerId;
  }

  if (typeof event.data?.pointerId === "number") {
    return event.data.pointerId;
  }

  return undefined;
};

const getNativeClientPoint = (event) => {
  if (!event || typeof event !== "object") {
    return null;
  }

  if (typeof event.clientX === "number" && typeof event.clientY === "number") {
    return {
      x: event.clientX,
      y: event.clientY,
    };
  }

  const touch = event.changedTouches?.[0] ?? event.touches?.[0];

  if (
    touch &&
    typeof touch.clientX === "number" &&
    typeof touch.clientY === "number"
  ) {
    return {
      x: touch.clientX,
      y: touch.clientY,
    };
  }

  return null;
};

const canUseNativeDragTracking = (app) =>
  typeof globalThis.addEventListener === "function" &&
  typeof globalThis.removeEventListener === "function" &&
  typeof globalThis.document?.addEventListener === "function" &&
  typeof globalThis.document?.removeEventListener === "function" &&
  typeof app?.renderer?.events?.mapPositionToPoint === "function";

const mapNativeEventToGlobalPoint = ({ app, nativeEvent }) => {
  const clientPoint = getNativeClientPoint(nativeEvent);

  if (!clientPoint) {
    return null;
  }

  const globalPoint = { x: 0, y: 0 };

  app.renderer.events.mapPositionToPoint(
    globalPoint,
    clientPoint.x,
    clientPoint.y,
  );

  return globalPoint;
};

const detachNativeDragListeners = (runtime) => {
  runtime.removeNativeDragListeners?.();
  runtime.removeNativeDragListeners = null;
};

const attachNativeDragListeners = ({ runtime, moveListener, upListener }) => {
  if (
    !canUseNativeDragTracking(runtime.app) ||
    runtime.removeNativeDragListeners
  ) {
    return;
  }

  const listeners = [];
  const addListener = (target, type, listener) => {
    target.addEventListener(type, listener, true);
    listeners.push([target, type, listener]);
  };

  if (typeof globalThis.PointerEvent === "function") {
    addListener(globalThis.document, "pointermove", moveListener);
    addListener(globalThis, "pointerup", upListener);
    addListener(globalThis, "pointercancel", upListener);
  } else {
    addListener(globalThis.document, "mousemove", moveListener);
    addListener(globalThis, "mouseup", upListener);

    if ("ontouchstart" in globalThis) {
      addListener(globalThis.document, "touchmove", moveListener);
      addListener(globalThis, "touchend", upListener);
      addListener(globalThis, "touchcancel", upListener);
    }
  }

  runtime.removeNativeDragListeners = () => {
    for (const [target, type, listener] of listeners) {
      target.removeEventListener(type, listener, true);
    }
  };
};

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

const applySliderRuntimeVisualState = (runtime) => {
  applySliderVisualState({
    sliderContainer: runtime.sliderContainer,
    sliderComputedNode: runtime.sliderComputedNode,
    thumb: runtime.thumb,
    currentValue: runtime.currentValue,
    hoverOverride:
      runtime.sliderComputedNode.hover && runtime.hoverController?.isHovering()
        ? runtime.sliderComputedNode.hover
        : null,
  });
};

const syncSliderRuntimeCursor = (runtime) => {
  const cursor =
    runtime.hoverController?.isHovering() === true
      ? runtime.sliderComputedNode.hover?.cursor
      : null;

  setSliderCursor({
    sliderContainer: runtime.sliderContainer,
    sliderComputedNode: runtime.sliderComputedNode,
    cursor,
  });
};

const ensureSliderRuntime = ({
  app,
  sliderContainer,
  sliderComputedNode,
  thumb,
  eventHandler,
}) => {
  /** @type {any} */
  let runtime = sliderContainer[SLIDER_RUNTIME];

  if (!runtime) {
    clearInheritedHoverTarget(sliderContainer);

    runtime = {
      app,
      sliderContainer,
      sliderComputedNode,
      thumb,
      eventHandler,
      currentValue: getInitialSliderValue(sliderComputedNode),
      isDragging: false,
      activePointerId: undefined,
      listenersBound: false,
      hoverController: null,
      removeNativeDragListeners: null,
    };

    runtime.hoverController = createHoverStateController({
      displayObject: sliderContainer,
      onHoverChange: () => {
        applySliderRuntimeVisualState(runtime);
        syncSliderRuntimeCursor(runtime);
      },
    });

    sliderContainer[SLIDER_RUNTIME] = runtime;
  }

  runtime.app = app;
  runtime.sliderContainer = sliderContainer;
  runtime.sliderComputedNode = sliderComputedNode;
  runtime.thumb = thumb;
  runtime.eventHandler = eventHandler;

  return runtime;
};

export const syncSliderRuntime = ({
  app,
  sliderContainer,
  sliderComputedNode,
  thumb,
  eventHandler,
  adoptExternalValue = true,
}) => {
  const runtime = ensureSliderRuntime({
    app,
    sliderContainer,
    sliderComputedNode,
    thumb,
    eventHandler,
  });

  if (adoptExternalValue) {
    runtime.currentValue = getInitialSliderValue(sliderComputedNode);
  }

  applySliderRuntimeVisualState(runtime);
  syncSliderRuntimeCursor(runtime);

  return runtime;
};

export const destroySliderRuntime = ({ sliderContainer }) => {
  const runtime = sliderContainer?.[SLIDER_RUNTIME];

  if (!runtime) {
    return;
  }

  detachNativeDragListeners(runtime);
  runtime.hoverController?.destroy?.();
  delete sliderContainer[SLIDER_RUNTIME];
};

export const bindSliderInteractions = ({
  app,
  sliderContainer,
  sliderComputedNode,
  thumb,
  eventHandler,
}) => {
  const runtime = ensureSliderRuntime({
    app,
    sliderContainer,
    sliderComputedNode,
    thumb,
    eventHandler,
  });

  if (runtime.listenersBound) {
    return;
  }

  runtime.listenersBound = true;

  const onChangeFromGlobalPoint = (globalPoint) => {
    const { sliderComputedNode: currentNode } = runtime;
    const newPosition = runtime.sliderContainer.toLocal(globalPoint);
    const newValue = getSliderValueFromPosition({
      position: newPosition,
      thumb: runtime.thumb,
      direction: currentNode.direction,
      min: currentNode.min,
      max: currentNode.max,
      step: currentNode.step,
      trackWidth: currentNode.width,
      trackHeight: currentNode.height,
    });

    if (newValue !== runtime.currentValue) {
      runtime.currentValue = newValue;
      applySliderRuntimeVisualState(runtime);

      if (currentNode.change?.payload && runtime.eventHandler) {
        runtime.eventHandler("change", {
          _event: { id: currentNode.id, value: runtime.currentValue },
          ...currentNode.change.payload,
        });
      }
    }
  };

  const onChange = (event) => {
    if (!event?.global) {
      return;
    }

    onChangeFromGlobalPoint(event.global);
  };

  const dragEndListener = (event) => {
    const pointerId = readPointerId(event);

    if (
      runtime.activePointerId !== undefined &&
      pointerId !== undefined &&
      pointerId !== runtime.activePointerId
    ) {
      return;
    }

    if (runtime.isDragging) {
      runtime.isDragging = false;
      runtime.activePointerId = undefined;
      detachNativeDragListeners(runtime);
    }
  };

  const nativeDragMoveListener = (nativeEvent) => {
    if (!runtime.isDragging) {
      return;
    }

    const pointerId = readPointerId(nativeEvent);

    if (
      runtime.activePointerId !== undefined &&
      pointerId !== undefined &&
      pointerId !== runtime.activePointerId
    ) {
      return;
    }

    const globalPoint = mapNativeEventToGlobalPoint({
      app: runtime.app,
      nativeEvent,
    });

    if (!globalPoint) {
      return;
    }

    onChangeFromGlobalPoint(globalPoint);
  };

  const dragStartListener = (event) => {
    runtime.isDragging = true;
    runtime.activePointerId = readPointerId(event);
    attachNativeDragListeners({
      runtime,
      moveListener: nativeDragMoveListener,
      upListener: dragEndListener,
    });
    onChange(event);
  };

  const dragMoveListener = (event) => {
    if (runtime.isDragging) {
      onChange(event);
    }
  };

  sliderContainer.on("pointerdown", dragStartListener);

  if (!canUseNativeDragTracking(app)) {
    sliderContainer.on("globalpointermove", dragMoveListener);
  }

  sliderContainer.on("pointerup", dragEndListener);
  sliderContainer.on("pointerupoutside", dragEndListener);

  const overListener = () => {
    runtime.hoverController?.setDirectHover(true);
    applySliderRuntimeVisualState(runtime);
    syncSliderRuntimeCursor(runtime);

    const hover = runtime.sliderComputedNode.hover;

    if (!hover) {
      return;
    }

    setSliderCursor({
      sliderContainer: runtime.sliderContainer,
      sliderComputedNode: runtime.sliderComputedNode,
      cursor: hover.cursor,
    });

    if (hover.soundSrc) {
      runtime.app?.audioStage?.add({
        id: `hover-${Date.now()}`,
        url: hover.soundSrc,
        loop: false,
      });
    }
  };

  const outListener = () => {
    if (runtime.isDragging) {
      return;
    }

    runtime.hoverController?.setDirectHover(false);
    applySliderRuntimeVisualState(runtime);
    syncSliderRuntimeCursor(runtime);
  };

  sliderContainer.on("pointerover", overListener);
  sliderContainer.on("pointerout", outListener);
  sliderContainer.on("pointerupoutside", outListener);
};
