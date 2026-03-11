import { Container, Graphics, Sprite, Texture } from "pixi.js";
import {
  buildTimeline,
  calculateMaxDuration,
  getValueAtTime,
} from "../../../util/animationTimeline.js";
import ReplaceDissolveFilter from "./ReplaceDissolveFilter.js";

const UNSUPPORTED_REPLACE_TYPES = new Set([
  "animated-sprite",
  "text-revealing",
]);
const DEFAULT_SUBJECT_VALUES = {
  translateX: 0,
  translateY: 0,
  alpha: 1,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
};
const NOOP_COMPLETION_TRACKER = {
  getVersion: () => 0,
  track: () => {},
  complete: () => {},
};

const destroyDisplayObject = (parent, displayObject) => {
  if (!displayObject || displayObject.destroyed) return;

  if (displayObject.parent === parent) {
    parent.removeChild(displayObject);
  } else {
    displayObject.removeFromParent?.();
  }

  displayObject.destroy({ children: true });
};

const getLocalBoundsRectangle = (displayObject) =>
  displayObject.getLocalBounds().rectangle.clone();

const createSnapshotSubject = (app, displayObject) => {
  const frame = getLocalBoundsRectangle(displayObject);
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
    frame,
    texture,
  };
};

const buildSubjectTimelines = (properties = {}) =>
  Object.entries(properties).map(([property, config]) => ({
    property,
    timeline: buildTimeline([
      {
        value: config.initialValue ?? DEFAULT_SUBJECT_VALUES[property] ?? 0,
      },
      ...config.keyframes,
    ]),
  }));

const createSubjectController = (wrapper, properties, app) => {
  const timelines = buildSubjectTimelines(properties);
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

const hasAnimatedSubjectProperties = (animation) =>
  Boolean(animation.subjects?.prev?.properties) ||
  Boolean(animation.subjects?.next?.properties);

const createMaskTexture = (mask) => {
  if (!mask) {
    return Texture.EMPTY;
  }

  if (mask.kind === "single") {
    return Texture.from(mask.texture);
  }

  if (mask.kind === "sequence") {
    return Texture.from(mask.textures[0]);
  }

  return null;
};

const buildCompositeMaskTexture = (mask) => {
  const canvas = document.createElement("canvas");
  const contexts = [];

  for (const item of mask.items) {
    const texture = Texture.from(item.texture);
    const resource = texture.source.resource;
    if (!resource) continue;
    contexts.push({ item, resource });
  }

  const first = contexts[0];
  const width = first?.resource?.width ?? 1;
  const height = first?.resource?.height ?? 1;
  canvas.width = width;
  canvas.height = height;

  const workingCanvas = document.createElement("canvas");
  workingCanvas.width = width;
  workingCanvas.height = height;
  const workingContext = workingCanvas.getContext("2d");
  const outputContext = canvas.getContext("2d");

  const readChannel = (data, channel) => {
    switch (channel) {
      case "green":
        return data[1];
      case "blue":
        return data[2];
      case "alpha":
        return data[3];
      default:
        return data[0];
    }
  };

  const combined = new Uint8ClampedArray(width * height * 4);
  const combineMode = mask.combine ?? "max";

  for (let index = 0; index < contexts.length; index++) {
    const { item, resource } = contexts[index];
    workingContext.clearRect(0, 0, width, height);
    workingContext.drawImage(resource, 0, 0, width, height);
    const imageData = workingContext.getImageData(0, 0, width, height).data;

    for (let offset = 0; offset < combined.length; offset += 4) {
      let value = readChannel(
        imageData.subarray(offset, offset + 4),
        item.channel ?? "red",
      );
      if (item.invert) {
        value = 255 - value;
      }

      if (index === 0) {
        combined[offset] = value;
        combined[offset + 1] = value;
        combined[offset + 2] = value;
        combined[offset + 3] = 255;
        continue;
      }

      const current = combined[offset];

      switch (combineMode) {
        case "min":
          value = Math.min(current, value);
          break;
        case "multiply":
          value = Math.round((current / 255) * (value / 255) * 255);
          break;
        case "add":
          value = Math.min(255, current + value);
          break;
        default:
          value = Math.max(current, value);
          break;
      }

      combined[offset] = value;
      combined[offset + 1] = value;
      combined[offset + 2] = value;
      combined[offset + 3] = 255;
    }
  }

  outputContext.putImageData(new ImageData(combined, width, height), 0, 0);
  return Texture.from(canvas);
};

const createDissolveOverlay = (
  app,
  animation,
  prevSubject,
  nextSubject,
  zIndex,
) => {
  const boundsContainer = new Container();
  boundsContainer.addChild(prevSubject.wrapper);
  boundsContainer.addChild(nextSubject.wrapper);
  const unionBounds = getLocalBoundsRectangle(boundsContainer);

  const prevCaptureRoot = new Container();
  prevCaptureRoot.addChild(prevSubject.wrapper);
  const nextCaptureRoot = new Container();
  nextCaptureRoot.addChild(nextSubject.wrapper);

  const prevTexture = app.renderer.generateTexture({
    target: prevCaptureRoot,
    frame: unionBounds,
  });
  const nextTexture = app.renderer.generateTexture({
    target: nextCaptureRoot,
    frame: unionBounds,
  });

  const overlay = new Container();
  overlay.zIndex = zIndex;

  const sprite = new Sprite(prevTexture);
  sprite.x = unionBounds.x;
  sprite.y = unionBounds.y;
  overlay.addChild(sprite);

  const maskTexture =
    animation.mask?.kind === "composite"
      ? buildCompositeMaskTexture(animation.mask)
      : createMaskTexture(animation.mask);

  const filter = new ReplaceDissolveFilter({
    nextTexture,
    maskTexture: maskTexture ?? Texture.EMPTY,
    mask: animation.mask,
  });

  sprite.filters = [filter];

  const progressTimeline = buildTimeline([
    {
      value: animation.mask?.progress?.initialValue ?? 0,
    },
    ...(animation.mask?.progress?.keyframes ?? []),
  ]);

  return {
    overlay,
    duration: calculateMaxDuration([{ timeline: progressTimeline }]),
    apply: (time) => {
      const progress = getValueAtTime(progressTimeline, time);
      filter.setProgress(progress);

      if (animation.mask?.kind === "sequence") {
        const textures = animation.mask.textures;
        const index = Math.min(
          textures.length - 1,
          Math.max(0, Math.round(progress * (textures.length - 1))),
        );
        filter.setMaskTexture(Texture.from(textures[index]));
      }
    },
    destroy: () => {
      overlay.removeFromParent();
      overlay.destroy({ children: true });
      prevSubject.texture.destroy(true);
      nextSubject.texture.destroy(true);
      prevTexture.destroy(true);
      nextTexture.destroy(true);
      if (animation.mask?.kind === "composite" && maskTexture) {
        maskTexture.destroy(true);
      }
    },
  };
};

const createSubjectOverlay = (
  app,
  animation,
  prevSubject,
  nextSubject,
  zIndex,
) => {
  const overlay = new Container();
  overlay.zIndex = zIndex;

  overlay.addChild(prevSubject.wrapper);
  overlay.addChild(nextSubject.wrapper);

  const prevController = animation.subjects?.prev?.properties
    ? createSubjectController(
        prevSubject.wrapper,
        animation.subjects.prev.properties,
        app,
      )
    : { duration: 0, apply: () => {} };

  const nextController = animation.subjects?.next?.properties
    ? createSubjectController(
        nextSubject.wrapper,
        animation.subjects.next.properties,
        app,
      )
    : { duration: 0, apply: () => {} };

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
      prevSubject.texture.destroy(true);
      nextSubject.texture.destroy(true);
    },
  };
};

const instantiateNextLiveElement = ({
  app,
  parent,
  nextElement,
  plugin,
  eventHandler,
  animationBus,
  elementPlugins,
  zIndex,
  signal,
}) => {
  const result = plugin.add({
    app,
    parent,
    element: nextElement,
    animations: [],
    eventHandler,
    animationBus,
    completionTracker: NOOP_COMPLETION_TRACKER,
    elementPlugins,
    zIndex,
    signal,
  });

  if (result && typeof result.then === "function") {
    throw new Error(
      `Replace animations do not support async add pipelines for "${nextElement.type}" yet.`,
    );
  }

  return (
    parent.children.find((child) => child.label === nextElement.id) ?? null
  );
};

export const runReplaceAnimation = ({
  app,
  parent,
  prevElement,
  nextElement,
  animation,
  animationBus,
  completionTracker,
  eventHandler,
  elementPlugins,
  plugin,
  zIndex,
  signal,
}) => {
  if (UNSUPPORTED_REPLACE_TYPES.has(nextElement.type)) {
    throw new Error(
      `Replace animations are not supported for element type "${nextElement.type}" yet.`,
    );
  }

  if (
    animation.mask && hasAnimatedSubjectProperties(animation)
  ) {
    throw new Error(
      `Animation "${animation.id}" cannot combine subject transforms with mask replace yet.`,
    );
  }

  const prevDisplayObject = parent.children.find(
    (child) => child.label === prevElement.id,
  );

  if (!prevDisplayObject) {
    throw new Error(
      `Replace animation "${animation.id}" could not find the previous live element "${prevElement.id}".`,
    );
  }

  const prevSubject = createSnapshotSubject(app, prevDisplayObject);
  destroyDisplayObject(parent, prevDisplayObject);

  const nextDisplayObject = instantiateNextLiveElement({
    app,
    parent,
    nextElement,
    plugin,
    eventHandler,
    animationBus,
    elementPlugins,
    zIndex,
    signal,
  });

  if (!nextDisplayObject) {
    throw new Error(
      `Replace animation "${animation.id}" could not create the next live element "${nextElement.id}".`,
    );
  }

  const nextSubject = createSnapshotSubject(app, nextDisplayObject);
  nextDisplayObject.visible = false;

  const replaceOverlay =
    animation.mask
      ? createDissolveOverlay(app, animation, prevSubject, nextSubject, zIndex)
      : createSubjectOverlay(app, animation, prevSubject, nextSubject, zIndex);

  parent.addChild(replaceOverlay.overlay);
  const stateVersion = completionTracker.getVersion();
  completionTracker.track(stateVersion);
  let finalized = false;

  const finalize = () => {
    if (finalized) return;
    finalized = true;

    if (nextDisplayObject && !nextDisplayObject.destroyed) {
      nextDisplayObject.visible = true;
    }

    replaceOverlay.destroy();
  };

  animationBus.dispatch({
    type: "START",
    payload: {
      id: animation.id,
      driver: "custom",
      duration: replaceOverlay.duration,
      applyFrame: replaceOverlay.apply,
      applyTargetState: finalize,
      onComplete: () => {
        completionTracker.complete(stateVersion);
        finalize();
      },
      onCancel: () => {
        completionTracker.complete(stateVersion);
        finalize();
      },
      isValid: () =>
        Boolean(replaceOverlay.overlay) &&
        !replaceOverlay.overlay.destroyed &&
        Boolean(nextDisplayObject) &&
        !nextDisplayObject.destroyed,
    },
  });
};

export default runReplaceAnimation;
