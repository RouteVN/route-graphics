import { getUpdateAnimations } from "../../../animations/planAnimations.js";

/**
 * A container's scale magnitude is baked into its computed geometry (see
 * parseContainer), so its Pixi display object only carries what is left: the
 * sign, or 0 when the container is collapsed. A zero scale bakes the geometry at
 * the inherited scale instead, so the group can grow again.
 *
 * Update tweens author whole scale values. While a tween runs, the display
 * object still shows the geometry of the state it started from, so each value
 * is converted into the factor that is left for that geometry. The tween then
 * shows the authored scale at every frame and ends where the next state's
 * geometry is drawn.
 */

const SCALE_AXES = [
  ["scaleX", "inheritedScaleX"],
  ["scaleY", "inheritedScaleY"],
];

const getAxisFactor = (element, scaleKey, inheritedKey) => {
  const inherited = element[inheritedKey] ?? 1;
  const baked = Math.abs(element[scaleKey] ?? 1) || inherited;

  return inherited / baked;
};

/**
 * @param {Object} element - Computed container whose geometry is on screen
 * @returns {{ scaleX: number, scaleY: number }} Display scale per authored unit
 */
export const getContainerLiveScaleFactor = (element) => ({
  scaleX: getAxisFactor(element, "scaleX", "inheritedScaleX"),
  scaleY: getAxisFactor(element, "scaleY", "inheritedScaleY"),
});

/**
 * The authored scale of a computed container, without its ancestors' scale.
 * @param {Object} element
 * @returns {{ scaleX: number, scaleY: number }}
 */
const getOwnScale = (element) => ({
  scaleX: (element.scaleX ?? 1) / (element.inheritedScaleX ?? 1),
  scaleY: (element.scaleY ?? 1) / (element.inheritedScaleY ?? 1),
});

/**
 * Target state for Auto scale tweens: the next authored scale, as a display
 * scale for the geometry on screen.
 * @param {Object} nextElement
 * @param {{ scaleX: number, scaleY: number }} factor
 */
export const getContainerLiveScaleTargetState = (nextElement, factor) => {
  const ownScale = getOwnScale(nextElement);
  const targetState = {};

  // Leave an axis out when nothing changes, like other elements do.
  for (const [scaleKey] of SCALE_AXES) {
    if (nextElement[scaleKey] !== undefined || factor[scaleKey] !== 1) {
      targetState[scaleKey] = ownScale[scaleKey] * factor[scaleKey];
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
  const updateAnimations = getUpdateAnimations(animations, targetId);

  if (factor.scaleX === 1 && factor.scaleY === 1) {
    return updateAnimations;
  }

  return updateAnimations.map((animation) => {
    const tween = animation.tween;

    if (!tween || !SCALE_AXES.some(([scaleKey]) => tween[scaleKey])) {
      return animation;
    }

    const convertedTween = { ...tween };

    for (const [scaleKey] of SCALE_AXES) {
      if (tween[scaleKey]) {
        convertedTween[scaleKey] = convertTrack(
          tween[scaleKey],
          factor[scaleKey],
        );
      }
    }

    return { ...animation, tween: convertedTween };
  });
};
