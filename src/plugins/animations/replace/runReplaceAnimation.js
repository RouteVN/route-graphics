import { Container, Matrix, RenderTexture, Sprite, Texture } from "pixi.js";
import {
  buildTimeline,
  calculateMaxDuration,
  getValueAtTime,
} from "../../../util/animationTimeline.js";
import {
  clearDeferredMountOperations,
  createRenderContext,
  flushDeferredMountOperations,
} from "../../elements/renderContext.js";
const DEFAULT_SUBJECT_VALUES = {
  translateX: 0,
  translateY: 0,
  alpha: 1,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
};

const clamp01 = (value) => Math.min(1, Math.max(0, value));

const smoothstep = (edge0, edge1, value) => {
  if (edge0 === edge1) {
    return value < edge0 ? 0 : 1;
  }

  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

export const sampleMaskReveal = ({ progress, maskValue, softness } = {}) => {
  const clampedMaskValue = clamp01(maskValue);
  const lowerEdge = clamp01(clampedMaskValue - softness);
  const upperEdge = clamp01(clampedMaskValue + softness);

  return smoothstep(lowerEdge, upperEdge, clamp01(progress));
};

const getLocalBoundsRectangle = (displayObject) =>
  displayObject.getLocalBounds().rectangle.clone();

const normalizeFrame = (frame) => {
  frame.width = Math.max(1, Math.ceil(frame.width));
  frame.height = Math.max(1, Math.ceil(frame.height));
  return frame;
};

const createSnapshotSubject = (app, displayObject) => {
  const frame = normalizeFrame(getLocalBoundsRectangle(displayObject));
  const texture = app.renderer.generateTexture({
    target: displayObject,
    frame,
  });

  const sprite = new Sprite(texture);
  sprite.x = frame.x;
  sprite.y = frame.y;

  const wrapper = new Container();
  wrapper.x = displayObject.x ?? 0;
  wrapper.y = displayObject.y ?? 0;
  wrapper.scale.set(displayObject.scale?.x ?? 1, displayObject.scale?.y ?? 1);
  wrapper.rotation = displayObject.rotation ?? 0;
  wrapper.alpha = displayObject.alpha ?? 1;
  wrapper.addChild(sprite);

  return {
    wrapper,
    texture,
  };
};

const buildSubjectTimelines = (tween = {}) =>
  Object.entries(tween).map(([property, config]) => ({
    property,
    timeline: buildTimeline([
      {
        value: config.initialValue ?? DEFAULT_SUBJECT_VALUES[property] ?? 0,
      },
      ...config.keyframes,
    ]),
  }));

const createSubjectController = (wrapper, tween, app) => {
  if (!wrapper || !tween) {
    return {
      duration: 0,
      apply: () => {},
    };
  }

  const timelines = buildSubjectTimelines(tween);
  const base = {
    x: wrapper.x,
    y: wrapper.y,
    alpha: wrapper.alpha,
    scaleX: wrapper.scale.x,
    scaleY: wrapper.scale.y,
    rotation: wrapper.rotation,
  };

  return {
    duration: calculateMaxDuration(timelines),
    apply: (time) => {
      wrapper.x = base.x;
      wrapper.y = base.y;
      wrapper.alpha = base.alpha;
      wrapper.scale.x = base.scaleX;
      wrapper.scale.y = base.scaleY;
      wrapper.rotation = base.rotation;

      for (const { property, timeline } of timelines) {
        const value = getValueAtTime(timeline, time);

        switch (property) {
          case "translateX":
            wrapper.x = base.x + value * app.renderer.width;
            break;
          case "translateY":
            wrapper.y = base.y + value * app.renderer.height;
            break;
          case "alpha":
            wrapper.alpha = base.alpha * value;
            break;
          case "scaleX":
            wrapper.scale.x = base.scaleX * value;
            break;
          case "scaleY":
            wrapper.scale.y = base.scaleY * value;
            break;
          case "rotation":
            wrapper.rotation = base.rotation + value;
            break;
        }
      }
    },
  };
};

const createMaskProgressTimeline = (mask) =>
  buildTimeline([
    {
      value: mask?.progress?.initialValue ?? 0,
    },
    ...(mask?.progress?.keyframes ?? []),
  ]);

const createCanvasContext = (width, height) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Replace mask composition could not create a 2D canvas.");
  }

  return {
    canvas,
    context,
  };
};

const readChannelValue = (pixelData, offset, channel = "red") => {
  switch (channel) {
    case "green":
      return pixelData[offset + 1];
    case "blue":
      return pixelData[offset + 2];
    case "alpha":
      return pixelData[offset + 3];
    default:
      return pixelData[offset];
  }
};

const extractMaskPixelsFromTexture = ({
  app,
  texture,
  width,
  height,
  channel = "red",
  invert = false,
}) => {
  const values = new Uint8ClampedArray(width * height);
  const maskSprite = new Sprite(Texture.from(texture));
  maskSprite.width = width;
  maskSprite.height = height;

  const maskContainer = new Container();
  maskContainer.addChild(maskSprite);

  const maskRenderTexture = RenderTexture.create({
    width,
    height,
  });

  app.renderer.render({
    container: maskContainer,
    target: maskRenderTexture,
    clear: true,
  });

  const imageData = app.renderer.extract.pixels(maskRenderTexture).pixels;

  for (let index = 0, offset = 0; index < values.length; index++, offset += 4) {
    let value = readChannelValue(imageData, offset, channel);

    if (invert) {
      value = 255 - value;
    }

    values[index] = value;
  }

  maskContainer.destroy({ children: true });
  maskRenderTexture.destroy(true);

  return values;
};

const buildCompositeMaskPixels = (app, mask, width, height) => {
  let combined = null;

  for (const item of mask.items) {
    const current = extractMaskPixelsFromTexture({
      app,
      texture: item.texture,
      width,
      height,
      channel: item.channel ?? "red",
      invert: item.invert ?? false,
    });

    if (!combined) {
      combined = current;
      continue;
    }

    for (let index = 0; index < combined.length; index++) {
      switch (mask.combine ?? "max") {
        case "min":
          combined[index] = Math.min(combined[index], current[index]);
          break;
        case "multiply":
          combined[index] = Math.round(
            (combined[index] / 255) * (current[index] / 255) * 255,
          );
          break;
        case "add":
          combined[index] = Math.min(255, combined[index] + current[index]);
          break;
        default:
          combined[index] = Math.max(combined[index], current[index]);
          break;
      }
    }
  }

  return combined ?? new Uint8ClampedArray(width * height);
};

const createMaskSampler = (app, mask, width, height) => {
  const progressTimeline = createMaskProgressTimeline(mask);
  const duration = calculateMaxDuration([{ timeline: progressTimeline }]);
  const softness = Math.max(mask?.softness ?? 0.001, 0.0001);

  if (!mask) {
    return {
      duration,
      progressTimeline,
      sample: () => 0,
      destroy: () => {},
    };
  }

  if (mask.kind === "single") {
    const pixels = extractMaskPixelsFromTexture({
      app,
      texture: mask.texture,
      width,
      height,
      channel: mask.channel ?? "red",
      invert: mask.invert ?? false,
    });

    return {
      duration,
      progressTimeline,
      sample: (progress, index) =>
        sampleMaskReveal({
          progress,
          maskValue: pixels[index] / 255,
          softness,
        }),
      destroy: () => {},
    };
  }

  if (mask.kind === "sequence") {
    const frames = mask.textures.map((texture) =>
      extractMaskPixelsFromTexture({
        app,
        texture,
        width,
        height,
        channel: mask.channel ?? "red",
        invert: mask.invert ?? false,
      }),
    );

    return {
      duration,
      progressTimeline,
      sample: (progress, index) => {
        const scaled = clamp01(progress) * Math.max(0, frames.length - 1);

        if (mask.sample === "linear" && frames.length > 1) {
          const lowerIndex = Math.floor(scaled);
          const upperIndex = Math.min(frames.length - 1, lowerIndex + 1);
          const ratio = scaled - lowerIndex;
          const maskValue =
            (frames[lowerIndex][index] * (1 - ratio) +
              frames[upperIndex][index] * ratio) /
            255;

          return sampleMaskReveal({
            progress,
            maskValue,
            softness,
          });
        }

        const frameIndex = Math.min(
          frames.length - 1,
          Math.max(0, Math.round(scaled)),
        );

        return sampleMaskReveal({
          progress,
          maskValue: frames[frameIndex][index] / 255,
          softness,
        });
      },
      destroy: () => {},
    };
  }

  const pixels = buildCompositeMaskPixels(app, mask, width, height);

  return {
    duration,
    progressTimeline,
    sample: (progress, index) =>
      sampleMaskReveal({
        progress,
        maskValue: pixels[index] / 255,
        softness,
      }),
    destroy: () => {},
  };
};

const getUnionBounds = (subjects) => {
  const boundsContainer = new Container();

  for (const subject of subjects) {
    if (subject?.wrapper) {
      boundsContainer.addChild(subject.wrapper);
    }
  }

  return normalizeFrame(getLocalBoundsRectangle(boundsContainer));
};

const renderOffscreenContainer = ({ app, container, target, frame }) => {
  app.renderer.render({
    container,
    target,
    clear: true,
    transform: new Matrix(1, 0, 0, 1, -frame.x, -frame.y),
  });
};

const destroySubjectSnapshot = (subject) => {
  subject?.texture?.destroy(true);
};

const createPlainOverlay = ({
  app,
  animation,
  prevSubject,
  nextSubject,
  zIndex,
}) => {
  const overlay = new Container();
  overlay.zIndex = zIndex;

  if (prevSubject?.wrapper) {
    overlay.addChild(prevSubject.wrapper);
  }

  if (nextSubject?.wrapper) {
    overlay.addChild(nextSubject.wrapper);
  }

  const prevController = createSubjectController(
    prevSubject?.wrapper ?? null,
    animation.prev?.tween,
    app,
  );
  const nextController = createSubjectController(
    nextSubject?.wrapper ?? null,
    animation.next?.tween,
    app,
  );

  return {
    overlay,
    duration: Math.max(prevController.duration, nextController.duration),
    apply: (time) => {
      prevController.apply(time);
      nextController.apply(time);
    },
    destroy: () => {
      overlay.removeFromParent();
      overlay.destroy({ children: true });
      destroySubjectSnapshot(prevSubject);
      destroySubjectSnapshot(nextSubject);
    },
  };
};

const createMaskedOverlay = ({
  app,
  animation,
  prevSubject,
  nextSubject,
  zIndex,
}) => {
  const unionBounds = getUnionBounds([prevSubject, nextSubject]);
  const prevRoot = new Container();
  const nextRoot = new Container();

  if (prevSubject?.wrapper) {
    prevRoot.addChild(prevSubject.wrapper);
  }

  if (nextSubject?.wrapper) {
    nextRoot.addChild(nextSubject.wrapper);
  }

  const prevTexture = RenderTexture.create({
    width: unionBounds.width,
    height: unionBounds.height,
  });
  const nextTexture = RenderTexture.create({
    width: unionBounds.width,
    height: unionBounds.height,
  });

  const { canvas: outputCanvas, context: outputContext } = createCanvasContext(
    unionBounds.width,
    unionBounds.height,
  );
  const outputImageData = outputContext.createImageData(
    unionBounds.width,
    unionBounds.height,
  );
  const outputTexture = Texture.from(outputCanvas);

  const overlay = new Container();
  overlay.zIndex = zIndex;

  const sprite = new Sprite(outputTexture);
  sprite.x = unionBounds.x;
  sprite.y = unionBounds.y;
  overlay.addChild(sprite);

  const maskSampler = createMaskSampler(
    app,
    animation.mask,
    unionBounds.width,
    unionBounds.height,
  );
  const prevController = createSubjectController(
    prevSubject?.wrapper ?? null,
    animation.prev?.tween,
    app,
  );
  const nextController = createSubjectController(
    nextSubject?.wrapper ?? null,
    animation.next?.tween,
    app,
  );
  const transparentPixels = new Uint8ClampedArray(
    unionBounds.width * unionBounds.height * 4,
  );

  return {
    overlay,
    duration: Math.max(
      prevController.duration,
      nextController.duration,
      maskSampler.duration,
    ),
    apply: (time) => {
      prevController.apply(time);
      nextController.apply(time);

      let prevPixels = transparentPixels;
      let nextPixels = transparentPixels;

      if (prevSubject?.wrapper) {
        renderOffscreenContainer({
          app,
          container: prevRoot,
          target: prevTexture,
          frame: unionBounds,
        });
        prevPixels = app.renderer.extract.pixels(prevTexture).pixels;
      }

      if (nextSubject?.wrapper) {
        renderOffscreenContainer({
          app,
          container: nextRoot,
          target: nextTexture,
          frame: unionBounds,
        });
        nextPixels = app.renderer.extract.pixels(nextTexture).pixels;
      }

      const progress = clamp01(
        getValueAtTime(maskSampler.progressTimeline, time),
      );
      const outputPixels = outputImageData.data;

      for (
        let offset = 0, pixelIndex = 0;
        offset < outputPixels.length;
        offset += 4, pixelIndex += 1
      ) {
        const reveal = maskSampler.sample(progress, pixelIndex);
        const keep = 1 - reveal;

        outputPixels[offset] = Math.round(
          prevPixels[offset] * keep + nextPixels[offset] * reveal,
        );
        outputPixels[offset + 1] = Math.round(
          prevPixels[offset + 1] * keep + nextPixels[offset + 1] * reveal,
        );
        outputPixels[offset + 2] = Math.round(
          prevPixels[offset + 2] * keep + nextPixels[offset + 2] * reveal,
        );
        outputPixels[offset + 3] = Math.round(
          prevPixels[offset + 3] * keep + nextPixels[offset + 3] * reveal,
        );
      }

      outputContext.putImageData(outputImageData, 0, 0);
      outputTexture.source.update();
    },
    destroy: () => {
      overlay.removeFromParent();
      overlay.destroy({ children: true });
      prevRoot.destroy({ children: true });
      nextRoot.destroy({ children: true });
      prevTexture.destroy(true);
      nextTexture.destroy(true);
      outputTexture.destroy(true);
      destroySubjectSnapshot(prevSubject);
      destroySubjectSnapshot(nextSubject);
      maskSampler.destroy();
    },
  };
};

const createReplaceOverlay = ({
  app,
  animation,
  prevSubject,
  nextSubject,
  zIndex,
}) => {
  if (animation.mask) {
    return createMaskedOverlay({
      app,
      animation,
      prevSubject,
      nextSubject,
      zIndex,
    });
  }

  return createPlainOverlay({
    app,
    animation,
    prevSubject,
    nextSubject,
    zIndex,
  });
};

const instantiateNextLiveElement = ({
  app,
  parent,
  nextElement,
  plugin,
  animations,
  eventHandler,
  animationBus,
  completionTracker,
  elementPlugins,
  renderContext,
  zIndex,
  signal,
}) => {
  if (!nextElement) {
    return null;
  }

  const result = plugin.add({
    app,
    parent,
    element: nextElement,
    animations,
    eventHandler,
    animationBus,
    completionTracker,
    elementPlugins,
    renderContext,
    zIndex,
    signal,
  });

  if (result && typeof result.then === "function") {
    return result.then(() => {
      if (signal?.aborted || parent.destroyed) {
        return null;
      }

      return (
        parent.children.find((child) => child.label === nextElement.id) ?? null
      );
    });
  }

  if (signal?.aborted || parent.destroyed) {
    return null;
  }

  return (
    parent.children.find((child) => child.label === nextElement.id) ?? null
  );
};

const resolveNextDisplayObject = async (nextDisplayObjectOrPromise) => {
  if (
    nextDisplayObjectOrPromise &&
    typeof nextDisplayObjectOrPromise.then === "function"
  ) {
    return nextDisplayObjectOrPromise;
  }

  return nextDisplayObjectOrPromise ?? null;
};

export const runReplaceAnimation = ({
  app,
  parent,
  prevElement,
  nextElement,
  animation,
  animations,
  animationBus,
  completionTracker,
  eventHandler,
  elementPlugins,
  renderContext,
  plugin,
  zIndex,
  signal,
}) => {
  if (!prevElement && !nextElement) {
    throw new Error(
      `Replace animation "${animation.id}" must receive prevElement and/or nextElement.`,
    );
  }

  if (signal?.aborted || parent.destroyed) {
    return;
  }

  const prevDisplayObject = prevElement
    ? (parent.children.find((child) => child.label === prevElement.id) ?? null)
    : null;

  if (prevElement && !prevDisplayObject) {
    throw new Error(
      `Transition animation "${animation.id}" could not find the previous element "${prevElement.id}".`,
    );
  }

  const prevSubject = prevDisplayObject
    ? createSnapshotSubject(app, prevDisplayObject)
    : null;

  const transitionMountParent = new Container();
  const hiddenMountContext = createRenderContext({
    suppressAnimations: true,
  });
  const stateVersion = completionTracker.getVersion();
  let completionTracked = false;

  const trackTransition = () => {
    if (completionTracked) {
      return;
    }

    completionTracker.track(stateVersion);
    completionTracked = true;
  };

  const completeTransition = () => {
    if (!completionTracked) {
      return;
    }

    completionTracker.complete(stateVersion);
    completionTracked = false;
  };

  const finalize = ({ flushDeferredEffects }) => {
    if (finalized) return;
    finalized = true;

    if (nextDisplayObjectRef.value && !nextDisplayObjectRef.value.destroyed) {
      nextDisplayObjectRef.value.visible = true;
    }

    replaceOverlayRef.value?.destroy();

    if (flushDeferredEffects) {
      flushDeferredMountOperations(hiddenMountContext);
      return;
    }

    clearDeferredMountOperations(hiddenMountContext);
  };
  const nextDisplayObjectRef = { value: null };
  const replaceOverlayRef = { value: null };
  let finalized = false;

  trackTransition();

  const continueWithNextDisplayObject = (nextDisplayObject) => {
    if (signal?.aborted || parent.destroyed) {
      clearDeferredMountOperations(hiddenMountContext);
      transitionMountParent.destroy({ children: true });
      destroySubjectSnapshot(prevSubject);
      completeTransition();
      return;
    }

    if (nextElement && !nextDisplayObject) {
      clearDeferredMountOperations(hiddenMountContext);
      completeTransition();
      throw new Error(
        `Transition animation "${animation.id}" could not create the next element "${nextElement.id}".`,
      );
    }

    nextDisplayObjectRef.value = nextDisplayObject;
    const nextSubject = nextDisplayObject
      ? createSnapshotSubject(app, nextDisplayObject)
      : null;

    transitionMountParent.destroy({ children: false });

    if (prevDisplayObject) {
      plugin.delete({
        app,
        parent,
        element: prevElement,
        animations: [],
        animationBus,
        completionTracker,
        eventHandler,
        elementPlugins,
        renderContext,
        signal,
      });
    }

    if (nextDisplayObject) {
      nextDisplayObject.zIndex = zIndex;
      parent.addChild(nextDisplayObject);
      nextDisplayObject.visible = false;
    }

    const replaceOverlay = createReplaceOverlay({
      app,
      animation,
      prevSubject,
      nextSubject,
      zIndex,
    });
    replaceOverlayRef.value = replaceOverlay;

    parent.addChild(replaceOverlay.overlay);
    animationBus.dispatch({
      type: "START",
      payload: {
        id: animation.id,
        driver: "custom",
        duration: replaceOverlay.duration,
        applyFrame: replaceOverlay.apply,
        applyTargetState: () => {
          finalize({ flushDeferredEffects: false });
        },
        onComplete: () => {
          finalize({ flushDeferredEffects: true });
          completeTransition();
        },
        onCancel: () => {
          completeTransition();
        },
        isValid: () =>
          Boolean(replaceOverlay.overlay) &&
          !replaceOverlay.overlay.destroyed &&
          (!nextDisplayObject || !nextDisplayObject.destroyed),
      },
    });
  };

  const nextDisplayObjectOrPromise = nextElement
    ? instantiateNextLiveElement({
        app,
        parent: transitionMountParent,
        nextElement,
        plugin,
        animations,
        eventHandler,
        animationBus,
        completionTracker,
        elementPlugins,
        renderContext: hiddenMountContext,
        zIndex,
        signal,
      })
    : null;

  if (
    nextDisplayObjectOrPromise &&
    typeof nextDisplayObjectOrPromise.then === "function"
  ) {
    void resolveNextDisplayObject(nextDisplayObjectOrPromise).then(
      continueWithNextDisplayObject,
    );
    return;
  }

  continueWithNextDisplayObject(nextDisplayObjectOrPromise ?? null);
};

export default runReplaceAnimation;
