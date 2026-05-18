const DEFAULT_PLAYBACK_FPS = 30;

const normalizeAtlasFrame = (frame = {}) => {
  if (frame.frame) {
    const width = frame.frame.w ?? 0;
    const height = frame.frame.h ?? 0;
    const sourceWidth = frame.sourceSize?.w ?? width;
    const sourceHeight = frame.sourceSize?.h ?? height;

    const normalized = {
      frame: {
        x: frame.frame.x ?? 0,
        y: frame.frame.y ?? 0,
        w: width,
        h: height,
      },
      rotated: frame.rotated ?? false,
      trimmed: frame.trimmed ?? false,
      spriteSourceSize: {
        x: frame.spriteSourceSize?.x ?? 0,
        y: frame.spriteSourceSize?.y ?? 0,
        w: frame.spriteSourceSize?.w ?? width,
        h: frame.spriteSourceSize?.h ?? height,
      },
      sourceSize: {
        w: sourceWidth,
        h: sourceHeight,
      },
    };

    if (frame.anchor) {
      normalized.anchor = {
        x: frame.anchor.x ?? 0,
        y: frame.anchor.y ?? 0,
      };
    } else if (frame.pivot) {
      normalized.anchor = {
        x: frame.pivot.x ?? 0,
        y: frame.pivot.y ?? 0,
      };
    }

    if (frame.borders) {
      normalized.borders = { ...frame.borders };
    }

    return normalized;
  }

  const width = frame.width ?? frame.w ?? 0;
  const height = frame.height ?? frame.h ?? 0;
  const sourceWidth = frame.sourceWidth ?? width;
  const sourceHeight = frame.sourceHeight ?? height;

  const normalized = {
    frame: {
      x: frame.x ?? 0,
      y: frame.y ?? 0,
      w: width,
      h: height,
    },
    rotated: frame.rotated ?? false,
    trimmed: frame.trimmed ?? false,
    spriteSourceSize: {
      x: frame.offsetX ?? 0,
      y: frame.offsetY ?? 0,
      w: width,
      h: height,
    },
    sourceSize: {
      w: sourceWidth,
      h: sourceHeight,
    },
  };

  if (frame.anchor) {
    normalized.anchor = {
      x: frame.anchor.x ?? 0,
      y: frame.anchor.y ?? 0,
    };
  } else if (frame.pivot) {
    normalized.anchor = {
      x: frame.pivot.x ?? 0,
      y: frame.pivot.y ?? 0,
    };
  }

  if (frame.borders) {
    normalized.borders = { ...frame.borders };
  }

  return normalized;
};

const normalizeAtlasAnimations = (animationsInput = {}) => {
  if (!animationsInput || typeof animationsInput !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(animationsInput).map(([clipName, frames]) => [
      clipName,
      Array.isArray(frames) ? frames.map((frame) => String(frame)) : [],
    ]),
  );
};

const buildFrameTagSequence = (frameNames, tag = {}) => {
  const from = Math.max(0, Number(tag.from ?? 0));
  const to = Math.min(frameNames.length - 1, Number(tag.to ?? from));

  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) {
    return [];
  }

  const sequence = frameNames.slice(from, to + 1);
  const direction = String(tag.direction ?? "forward").toLowerCase();

  if (direction === "reverse" || direction === "backward") {
    return [...sequence].reverse();
  }

  if (direction === "pingpong") {
    return [...sequence, ...sequence.slice(1, -1).reverse()];
  }

  if (direction === "pingpong_reverse") {
    const reversed = [...sequence].reverse();
    return [...reversed, ...reversed.slice(1, -1).reverse()];
  }

  return sequence;
};

const normalizeAsepriteFrameTags = (frameTagsInput = [], frameNames = []) => {
  if (!Array.isArray(frameTagsInput) || frameNames.length === 0) {
    return {};
  }

  return Object.fromEntries(
    frameTagsInput
      .map((tag) => {
        const clipName = typeof tag?.name === "string" ? tag.name : "";
        if (!clipName) {
          return null;
        }

        return [clipName, buildFrameTagSequence(frameNames, tag)];
      })
      .filter(Boolean),
  );
};

export const normalizeAnimatedSpriteAtlas = (atlasInput = {}) => {
  const atlas = atlasInput ?? {};
  const animations = normalizeAtlasAnimations(atlas.animations);
  const frames = Array.isArray(atlas.frames)
    ? Object.fromEntries(
        atlas.frames
          .map((frame) => {
            const frameName = frame?.filename ?? frame?.name;

            if (typeof frameName !== "string" || frameName.length === 0) {
              return null;
            }

            return [frameName, normalizeAtlasFrame(frame)];
          })
          .filter(Boolean),
      )
    : Object.fromEntries(
        Object.entries(atlas.frames ?? {}).map(([frameName, frame]) => [
          frameName,
          normalizeAtlasFrame(frame),
        ]),
      );

  return {
    frames,
    ...(Object.keys(animations).length > 0 ? { animations } : {}),
    meta: {
      ...(atlas.meta ?? {}),
      scale: String(atlas.scale ?? atlas.meta?.scale ?? 1),
      ...(atlas.width != null || atlas.height != null
        ? {
            size: {
              w: atlas.width ?? atlas.meta?.size?.w ?? 0,
              h: atlas.height ?? atlas.meta?.size?.h ?? 0,
            },
          }
        : {}),
    },
  };
};

export const normalizeAnimatedSpriteClips = (
  clipsInput = {},
  atlasAnimations = {},
  atlasMeta = {},
  atlasFrameNames = [],
) => ({
  ...normalizeAsepriteFrameTags(atlasMeta?.frameTags, atlasFrameNames),
  ...normalizeAtlasAnimations(atlasAnimations),
  ...normalizeAtlasAnimations(clipsInput),
});

const resolveLegacyPlaybackFrames = (atlas, legacyAnimation) => {
  if (!Array.isArray(legacyAnimation?.frames)) {
    return [];
  }

  const frameNames = Object.keys(atlas.frames ?? {});

  return legacyAnimation.frames
    .map((frame) =>
      typeof frame === "number" ? frameNames[frame] : String(frame),
    )
    .filter(Boolean);
};

export const normalizeAnimatedSpritePlayback = ({
  atlas = { frames: {} },
  clips = {},
  playback,
  legacyAnimation,
}) => {
  const input = playback ?? legacyAnimation ?? {};
  const normalized = {
    fps: input.fps ?? null,
    loop: input.loop ?? true,
    autoplay: input.autoplay ?? true,
  };

  if (typeof input.clip === "string" && input.clip.length > 0) {
    normalized.clip = input.clip;
  }

  if (Array.isArray(input.frames)) {
    normalized.frames = input.frames
      .map((frame) =>
        typeof frame === "number"
          ? Object.keys(atlas.frames ?? {})[frame]
          : String(frame),
      )
      .filter(Boolean);
  } else if (!normalized.clip) {
    normalized.frames = resolveLegacyPlaybackFrames(atlas, legacyAnimation);
  }

  if (normalized.fps == null) {
    if (typeof input.animationSpeed === "number") {
      normalized.fps = input.animationSpeed * 60;
    } else {
      normalized.fps = DEFAULT_PLAYBACK_FPS;
    }
  }

  if (
    normalized.clip &&
    (!Array.isArray(normalized.frames) || normalized.frames.length === 0)
  ) {
    normalized.frames = Array.isArray(clips[normalized.clip])
      ? [...clips[normalized.clip]]
      : [];
  }

  if (!Array.isArray(normalized.frames)) {
    normalized.frames = [];
  }

  return normalized;
};

export const resolveAnimatedSpriteFrameTextures = ({
  spritesheet,
  atlas,
  clips = {},
  playback,
  legacyAnimation,
}) => {
  const normalizedPlayback = normalizeAnimatedSpritePlayback({
    atlas,
    clips,
    playback,
    legacyAnimation,
  });

  const frameTextures = normalizedPlayback.frames.map(
    (frameName) => spritesheet.textures[frameName],
  );

  return {
    frameTextures,
    playback: normalizedPlayback,
  };
};

export const playbackFpsToAnimationSpeed = (fps) =>
  typeof fps === "number" ? fps / 60 : DEFAULT_PLAYBACK_FPS / 60;
