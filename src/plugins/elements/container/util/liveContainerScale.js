import {
  getAnimationContinuitySignature,
  getUpdateAnimations,
  groupAnimationsByTarget,
} from "../../../animations/planAnimations.js";

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
 * Converts the tracks of an update tween, or of both sides of a transition.
 * Portable GSAP timelines are left as authored.
 * @param {Object} animation
 * @param {Array<[string, number]>} trackFactors - Tween property and factor
 * @returns {Object} The animation, or a converted copy
 */
const convertAnimation = (animation, trackFactors) => {
  if (animation.gsap) {
    return animation;
  }

  let converted;

  if (animation.type === "update") {
    const tween = convertTween(animation.tween, trackFactors);

    if (tween !== animation.tween) {
      converted = { ...animation, tween };
    }
  } else if (animation.type === "transition") {
    const prev = convertTransitionSide(animation.prev, trackFactors);
    const next = convertTransitionSide(animation.next, trackFactors);

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
 * @param {Array|Map} animations
 * @param {Object} element - Computed container whose children are rendered
 * @returns {Array|Map} The same collection, or a converted copy as a Map
 */
export const getContainerChildAnimations = (animations, element) => {
  const contentScale = getContainerContentScale(element);

  if (!animations || (contentScale.scaleX === 1 && contentScale.scaleY === 1)) {
    return animations;
  }

  const trackFactors = CHILD_TRACK_AXES.map(([property, scaleKey]) => [
    property,
    contentScale[scaleKey],
  ]);
  const animationsByTarget = groupAnimationsByTarget(animations);
  let converted;

  for (const child of element.children ?? []) {
    const childAnimations = animationsByTarget.get(child.id);

    if (!childAnimations) {
      continue;
    }

    const convertedChildAnimations = childAnimations.map((animation) =>
      convertAnimation(animation, trackFactors),
    );

    if (
      convertedChildAnimations.some(
        (animation, index) => animation !== childAnimations[index],
      )
    ) {
      converted ??= new Map(animationsByTarget);
      converted.set(child.id, convertedChildAnimations);
    }
  }

  return converted ?? animations;
};
