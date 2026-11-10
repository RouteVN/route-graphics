import {
  getAnimationContinuitySignature,
  getUpdateAnimations,
  groupAnimationsByTarget,
} from "../../../animations/planAnimations.js";
import { isInfiniteUpdateAnimation } from "../../../animations/updateAnimationDispatch.js";

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
 * @param {Object} [sides] - Which parts to convert
 * @param {boolean} [sides.prev] - A transition's prev side
 * @param {boolean} [sides.next] - A transition's next side, or an update tween
 * @returns {Object} The animation, or a converted copy
 */
const convertAnimation = (
  animation,
  trackFactors,
  sides = { prev: true, next: true },
) => {
  if (animation.gsap) {
    return animation;
  }

  let converted;

  if (animation.type === "update") {
    const tween = sides.next
      ? convertTween(animation.tween, trackFactors)
      : animation.tween;

    if (tween !== animation.tween) {
      converted = { ...animation, tween };
    }
  } else if (animation.type === "transition") {
    const prev = sides.prev
      ? convertTransitionSide(animation.prev, trackFactors)
      : animation.prev;
    const next = sides.next
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
 * Returns the container's own update animations with their scale tracks
 * converted to display scales. Other targets' animations are left out, since
 * dispatching only reads the container's own animations.
 * @param {Array|Map} animations
 * @param {string} targetId
 * @param {{ scaleX: number, scaleY: number }} factor
 */
export const getContainerLiveScaleAnimations = (
  animations,
  targetId,
  factor,
) => {
  const trackFactors = SCALE_AXES.map(([scaleKey]) => [
    scaleKey,
    factor[scaleKey],
  ]);

  return getUpdateAnimations(animations, targetId).map((animation) =>
    convertAnimation(animation, trackFactors),
  );
};

/**
 * Returns the animations to render a container's children with: the x and y
 * tracks of its direct children's update and transition tweens, and the width
 * and height tracks of a rect child, are converted from the container's
 * unscaled space into rendered pixels. Deeper descendants are converted by
 * their own parent container.
 *
 * Each part is converted by the container that draws it: a transition's prev
 * side if the child was in this container before, and its next side and
 * update tweens if the child is in it now. A removed child's exit transition
 * is therefore converted here, and a child that moves to another container is
 * converted once on each side. Children are rendered in the next state's
 * geometry, so its scale is used for both sides.
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
  let converted;

  for (const childId of new Set([...prevChildIds, ...nextChildIds])) {
    const childAnimations = animationsByTarget.get(childId);

    if (!childAnimations) {
      continue;
    }

    const sides = {
      prev: prevChildIds.has(childId),
      next: nextChildIds.has(childId),
    };
    const convertedChildAnimations = childAnimations.map((animation) =>
      convertAnimation(animation, trackFactors, sides),
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
