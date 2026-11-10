import {
  getAnimationContinuitySignature,
  getUpdateAnimations,
  groupAnimationsByTarget,
} from "../../../animations/planAnimations.js";
import { isInfiniteUpdateAnimation } from "../../../animations/updateAnimationDispatch.js";
import { collectAllElementIds } from "../../../../util/collectElementIds.js";

/**
 * A container's scale magnitude is baked into its computed geometry (see
 * parseContainer), so its Pixi display object only carries what is left: the
 * sign, or 0 when the container is collapsed. A zero scale bakes the geometry at
 * the inherited scale instead, so the group can grow again.
 *
 * Update tweens author whole values in the units of the space they are
 * authored in. These helpers convert them into the rendered values that the
 * baked geometry on screen needs, so a tween shows the authored value at every
 * frame and ends where the next state's geometry is drawn:
 * - the container's own scale tracks are converted into the display scale left
 *   for the geometry it is showing;
 * - its children's x and y tracks (update tweens and both sides of
 *   transitions) and a rect child's width and height tracks, authored in the
 *   container's unscaled space, are multiplied by the container's baked scale.
 */

const SCALE_AXES = [
  ["scaleX", "inheritedScaleX"],
  ["scaleY", "inheritedScaleY"],
];

// Child tracks authored in the container's unscaled space, with the scale axis
// that converts each of them. Animations are normalized before rendering, so a
// rect's width and height tweens arrive as rect.width and rect.height.
const CHILD_TRACK_AXES = [
  ["x", "scaleX"],
  ["rect.width", "scaleX"],
  ["y", "scaleY"],
  ["rect.height", "scaleY"],
];

const getBakedScale = (element, scaleKey, inheritedKey) =>
  Math.abs(element[scaleKey] ?? 1) || (element[inheritedKey] ?? 1);

/**
 * The scale baked into a computed container's children.
 * @param {Object} element - Computed container
 * @returns {{ scaleX: number, scaleY: number }}
 */
export const getContainerContentScale = (element) => ({
  scaleX: getBakedScale(element, "scaleX", "inheritedScaleX"),
  scaleY: getBakedScale(element, "scaleY", "inheritedScaleY"),
});

/**
 * The computed container whose geometry is on screen while its own update
 * animations run. That is the previous one, since the next state is rendered
 * when they complete, unless one of them never ends: dispatching it renders
 * the next state first.
 * @param {Object} params
 * @param {Array|Map} params.animations
 * @param {Object} [params.animationBus]
 * @param {Object} params.prevElement
 * @param {Object} params.nextElement
 * @returns {Object}
 */
export const getContainerTweenedElement = ({
  animations,
  animationBus,
  prevElement,
  nextElement,
}) => {
  // Animations that continue from an earlier render are not dispatched again.
  const rendersNextStateFirst = getUpdateAnimations(
    animations,
    prevElement.id,
  ).some(
    (animation) =>
      !(
        typeof animationBus?.hasContext === "function" &&
        animationBus.hasContext(animation.id)
      ) && isInfiniteUpdateAnimation(animation),
  );

  return rendersNextStateFirst ? nextElement : prevElement;
};

/**
 * Display scale per authored unit of the container's own scale, for the
 * geometry on screen. The ancestors' scale comes from the next state, which
 * ancestors have already rendered when this container updates.
 * @param {Object} element - Computed container whose geometry is on screen
 * @param {Object} [nextElement] - Computed container being rendered next
 * @returns {{ scaleX: number, scaleY: number }}
 */
export const getContainerLiveScaleFactor = (element, nextElement = element) => {
  const factor = {};

  for (const [scaleKey, inheritedKey] of SCALE_AXES) {
    factor[scaleKey] =
      (nextElement[inheritedKey] ?? 1) /
      getBakedScale(element, scaleKey, inheritedKey);
  }

  return factor;
};

/**
 * Where scale tweens start when the next state is drawn before they run (see
 * getContainerTweenedElement): the size on screen, as a display scale for the
 * next state's geometry. Without it a tween that sets no start value would
 * start from the next state's size.
 * @param {Object} displayObject - The container's Pixi display object
 * @param {Object} prevElement - Computed container on screen
 * @param {Object} nextElement - Computed container drawn next
 * @returns {{ scaleX: number, scaleY: number } | undefined} Undefined when
 * the geometry keeps its size
 */
export const getContainerTweenStartScale = (
  displayObject,
  prevElement,
  nextElement,
) => {
  const prevScale = getContainerContentScale(prevElement);
  const nextScale = getContainerContentScale(nextElement);

  if (
    prevScale.scaleX === nextScale.scaleX &&
    prevScale.scaleY === nextScale.scaleY
  ) {
    return undefined;
  }

  return {
    scaleX: displayObject.scale.x * (prevScale.scaleX / nextScale.scaleX),
    scaleY: displayObject.scale.y * (prevScale.scaleY / nextScale.scaleY),
  };
};

/**
 * Target state for Auto scale tweens: the next authored scale, as a display
 * scale for the geometry on screen.
 * @param {Object} nextElement
 * @param {{ scaleX: number, scaleY: number }} factor
 */
export const getContainerLiveScaleTargetState = (nextElement, factor) => {
  const targetState = {};

  // Leave an axis out when nothing changes, like other elements do.
  for (const [scaleKey, inheritedKey] of SCALE_AXES) {
    if (nextElement[scaleKey] !== undefined || factor[scaleKey] !== 1) {
      const ownScale =
        (nextElement[scaleKey] ?? 1) / (nextElement[inheritedKey] ?? 1);
      targetState[scaleKey] = ownScale * factor[scaleKey];
    }
  }

  return targetState;
};

const convertTrack = (track, factor) => {
  if (!track || !Array.isArray(track.keyframes)) {
    return track;
  }

  const converted = { ...track };

  if (typeof track.initialValue === "number") {
    converted.initialValue = track.initialValue * factor;
  }
  converted.keyframes = track.keyframes.map((keyframe) => {
    const nextKeyframe = { ...keyframe };

    if (typeof keyframe.value === "number") {
      nextKeyframe.value = keyframe.value * factor;
    }
    if (typeof keyframe.startValue === "number") {
      nextKeyframe.startValue = keyframe.startValue * factor;
    }

    return nextKeyframe;
  });

  return converted;
};

const convertTween = (tween, trackFactors) => {
  if (!tween) {
    return tween;
  }

  const tracks = trackFactors.filter(
    ([property, factor]) => tween[property] && factor !== 1,
  );

  if (tracks.length === 0) {
    return tween;
  }

  const convertedTween = { ...tween };

  for (const [property, factor] of tracks) {
    convertedTween[property] = convertTrack(tween[property], factor);
  }

  return convertedTween;
};

const convertTransitionSide = (side, trackFactors) => {
  const tween = convertTween(side?.tween, trackFactors);

  return tween === side?.tween ? side : { ...side, tween };
};

/**
 * Converts the tracks of an update tween, or of the sides of a transition.
 * Portable GSAP timelines are left as authored.
 * @param {Object} animation
 * @param {Array<[string, number]>} trackFactors - Tween property and factor
 * @param {Object} [parts] - Which parts to convert
 * @param {boolean} [parts.update] - An update tween
 * @param {boolean} [parts.prev] - A transition's prev side
 * @param {boolean} [parts.next] - A transition's next side
 * @returns {Object} The animation, or a converted copy
 */
const convertAnimation = (
  animation,
  trackFactors,
  parts = { update: true, prev: true, next: true },
) => {
  if (animation.gsap) {
    return animation;
  }

  let converted;

  if (animation.type === "update") {
    const tween = parts.update
      ? convertTween(animation.tween, trackFactors)
      : animation.tween;

    if (tween !== animation.tween) {
      converted = { ...animation, tween };
    }
  } else if (animation.type === "transition") {
    const prev = parts.prev
      ? convertTransitionSide(animation.prev, trackFactors)
      : animation.prev;
    const next = parts.next
      ? convertTransitionSide(animation.next, trackFactors)
      : animation.next;

    if (prev !== animation.prev || next !== animation.next) {
      converted = { ...animation, prev, next };
    }
  }

  if (!converted) {
    return animation;
  }

  // Persistent continuity compares the running animation with the authored
  // one, so the converted copy keeps the authored signature.
  converted.signature =
    animation.signature ?? getAnimationContinuitySignature(animation);

  return converted;
};

/**
 * Gives an update tween's scale tracks that set no start value the start
 * scale, keeping the authored animation's continuity signature.
 * @param {Object} animation - The animation, possibly already converted
 * @param {Object} authored - The authored animation
 * @param {{ scaleX: number, scaleY: number }} startScale
 * @returns {Object} The animation, or a copy with start values
 */
const withScaleStart = (animation, authored, startScale) => {
  const scaleKeys = SCALE_AXES.map(([scaleKey]) => scaleKey).filter(
    (scaleKey) =>
      animation.tween?.[scaleKey] &&
      animation.tween[scaleKey].initialValue === undefined,
  );

  if (animation.gsap || scaleKeys.length === 0) {
    return animation;
  }

  const tween = { ...animation.tween };

  for (const scaleKey of scaleKeys) {
    tween[scaleKey] = {
      ...tween[scaleKey],
      initialValue: startScale[scaleKey],
    };
  }

  return {
    ...animation,
    tween,
    signature: authored.signature ?? getAnimationContinuitySignature(authored),
  };
};

/**
 * Returns the container's own update animations with their scale tracks
 * converted to display scales. Other targets' animations are left out, since
 * dispatching only reads the container's own animations.
 * @param {Array|Map} animations
 * @param {string} targetId
 * @param {{ scaleX: number, scaleY: number }} factor
 * @param {{ scaleX: number, scaleY: number }} [startScale] - Start value for
 * scale tracks that set none, except in animations that never end (see
 * getContainerTweenStartScale)
 */
export const getContainerLiveScaleAnimations = (
  animations,
  targetId,
  factor,
  startScale,
) => {
  const trackFactors = SCALE_AXES.map(([scaleKey]) => [
    scaleKey,
    factor[scaleKey],
  ]);

  return getUpdateAnimations(animations, targetId).map((animation) => {
    const converted = convertAnimation(animation, trackFactors);

    // A loop starts each cycle from where it started, so it starts from the
    // next state's size and keeps no start value.
    return startScale && !isInfiniteUpdateAnimation(animation)
      ? withScaleStart(converted, animation, startScale)
      : converted;
  });
};

/**
 * Returns the animations to render a container's children with: the x and y
 * tracks of its direct children's update and transition tweens, and the width
 * and height tracks of a rect child, are converted from the container's
 * unscaled space into rendered pixels. Deeper descendants are converted by
 * their own parent container.
 *
 * Each part is converted by the container that draws it: a transition's prev
 * side if the child was in this container before, its next side if the child
 * is in it now, and update tweens if the child is in it now or is being
 * removed from it (a removed element runs its update tweens before it is
 * deleted). A child that moves deeper into this container is converted there
 * instead. Children are rendered in the next state's geometry, so its scale
 * is used for every part.
 * @param {Array|Map} animations
 * @param {Object} element - Computed container whose children are rendered
 * @param {Object} [prevElement] - The same container in the previous state
 * @returns {Array|Map} The same collection, or a converted copy as a Map
 */
export const getContainerChildAnimations = (
  animations,
  element,
  prevElement,
) => {
  const contentScale = getContainerContentScale(element);

  if (!animations || (contentScale.scaleX === 1 && contentScale.scaleY === 1)) {
    return animations;
  }

  const trackFactors = CHILD_TRACK_AXES.map(([property, scaleKey]) => [
    property,
    contentScale[scaleKey],
  ]);
  const animationsByTarget = groupAnimationsByTarget(animations);
  const prevChildIds = new Set(
    (prevElement?.children ?? []).map((child) => child.id),
  );
  const nextChildIds = new Set(
    (element.children ?? []).map((child) => child.id),
  );
  let nextDescendantIds;
  let converted;

  for (const childId of new Set([...prevChildIds, ...nextChildIds])) {
    const childAnimations = animationsByTarget.get(childId);

    if (!childAnimations) {
      continue;
    }

    const isChild = nextChildIds.has(childId);

    if (!isChild) {
      nextDescendantIds ??= collectAllElementIds({
        children: element.children,
      });
    }

    const parts = {
      update: isChild || !nextDescendantIds.has(childId),
      prev: prevChildIds.has(childId),
      next: isChild,
    };
    const convertedChildAnimations = childAnimations.map((animation) =>
      convertAnimation(animation, trackFactors, parts),
    );

    if (
      convertedChildAnimations.some(
        (animation, index) => animation !== childAnimations[index],
      )
    ) {
      converted ??= new Map(animationsByTarget);
      converted.set(childId, convertedChildAnimations);
    }
  }

  return converted ?? animations;
};
