import {
  Container,
  Sprite,
  Text,
  TextStyle,
  Texture,
  getCanvasTexture,
} from "pixi.js";
import { getCharacterXPositionInATextObject } from "../../../util/getCharacterXPositionInATextObject";
import abortableSleep from "../../../util/abortableSleep";
import { toPixiTextStyle } from "../../../util/toPixiTextStyle.js";
import {
  getSoftWipeEdgeWidth,
  getSoftWipeEasing,
  normalizeSoftWipeConfig,
} from "./softWipeConfig.js";

const TEXT_REVEAL_RUNTIME = Symbol("textRevealRuntime");
const TEXT_REVEAL_SNAPSHOT = Symbol("textRevealSnapshot");
const DEFAULT_TEXT_REVEAL_SPEED = 50;
const MIN_TEXT_REVEAL_SPEED = 0;
const MAX_TEXT_REVEAL_SPEED = 100;
const MAX_ANIMATED_TEXT_REVEAL_SPEED = MAX_TEXT_REVEAL_SPEED - 1;
const MIN_TEXT_REVEAL_RATE = 10;
const MAX_TEXT_REVEAL_RATE = 120;
const TEXT_REVEAL_RATE_CURVE = 0.9;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const clampTextRevealSpeed = (speed = DEFAULT_TEXT_REVEAL_SPEED) => {
  if (typeof speed !== "number" || !Number.isFinite(speed)) {
    return DEFAULT_TEXT_REVEAL_SPEED;
  }

  return Math.max(
    MIN_TEXT_REVEAL_SPEED,
    Math.min(MAX_TEXT_REVEAL_SPEED, speed),
  );
};

export const isInstantTextRevealSpeed = (speed) =>
  clampTextRevealSpeed(speed) >= MAX_TEXT_REVEAL_SPEED;

const getEffectiveSpeed = (speed) => {
  const clampedSpeed = Math.min(
    clampTextRevealSpeed(speed),
    MAX_ANIMATED_TEXT_REVEAL_SPEED,
  );
  const normalizedSpeed =
    MAX_ANIMATED_TEXT_REVEAL_SPEED > 0
      ? clampedSpeed / MAX_ANIMATED_TEXT_REVEAL_SPEED
      : 0;
  const curvedSpeed = normalizedSpeed ** TEXT_REVEAL_RATE_CURVE;

  return (
    MIN_TEXT_REVEAL_RATE *
    (MAX_TEXT_REVEAL_RATE / MIN_TEXT_REVEAL_RATE) ** curvedSpeed
  );
};

const getTextRevealSnapshotMode = (element) =>
  element?.revealEffect === "softWipe" ? "softWipe" : "typewriter";

const getInitialRevealedCharacters = (element) => {
  const value = element?.initialRevealedCharacters;

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
};

const getTextRevealCharacterCount = (element) =>
  (element?.content ?? []).reduce(
    (chunkTotal, chunk) =>
      chunkTotal +
      (chunk.lineParts ?? []).reduce(
        (partTotal, part) => partTotal + (part.text?.length ?? 0),
        0,
      ),
    0,
  );

export const shouldRenderTextRevealImmediately = (element) =>
  element?.revealEffect === "none" ||
  isInstantTextRevealSpeed(element?.speed ?? DEFAULT_TEXT_REVEAL_SPEED);

const createIndicatorSprite = (element) => {
  let indicatorSprite = new Sprite(Texture.EMPTY);

  if (element?.indicator?.revealing?.src) {
    const revealingTexture = Texture.from(element.indicator.revealing.src);

    indicatorSprite = new Sprite(revealingTexture);
    indicatorSprite.width =
      element.indicator.revealing.width ?? revealingTexture.width;
    indicatorSprite.height =
      element.indicator.revealing.height ?? revealingTexture.height;
  }

  return indicatorSprite;
};

const applyCompleteIndicator = (indicatorSprite, element) => {
  if (!element?.indicator?.complete?.src) {
    return;
  }

  const completeTexture = Texture.from(element.indicator.complete.src);

  indicatorSprite.texture = completeTexture;
  indicatorSprite.width =
    element.indicator.complete.width ?? completeTexture.width;
  indicatorSprite.height =
    element.indicator.complete.height ?? completeTexture.height;
};

const positionIndicatorForChunk = (indicatorSprite, chunk, indicatorOffset) => {
  indicatorSprite.x = indicatorOffset;
  indicatorSprite.y = chunk
    ? chunk.y + (chunk.lineMaxHeight - indicatorSprite.height)
    : 0;
};

const positionIndicatorAtTextEnd = (
  indicatorSprite,
  lastTextObject,
  indicatorOffset,
) => {
  if (!lastTextObject || lastTextObject.text.length === 0) {
    indicatorSprite.x = indicatorOffset;
    return;
  }

  indicatorSprite.x =
    getCharacterXPositionInATextObject(
      lastTextObject,
      lastTextObject.text.length - 1,
    ) + indicatorOffset;
};

const registerTextRevealRuntime = (container, cleanup) => {
  if (container[TEXT_REVEAL_RUNTIME]) {
    const previousCleanup = container[TEXT_REVEAL_RUNTIME];

    delete container[TEXT_REVEAL_RUNTIME];
    previousCleanup();
  }

  container[TEXT_REVEAL_RUNTIME] = cleanup;
};

const getTextRevealSnapshot = (container) =>
  container?.[TEXT_REVEAL_SNAPSHOT] ?? null;

const setTextRevealSnapshot = (container, snapshot) => {
  if (!container) {
    return null;
  }

  if (!snapshot) {
    delete container[TEXT_REVEAL_SNAPSHOT];
    return null;
  }

  container[TEXT_REVEAL_SNAPSHOT] = snapshot;

  return snapshot;
};

const getResumableTypewriterSnapshot = (container) => {
  const snapshot = getTextRevealSnapshot(container);

  if (
    !snapshot ||
    snapshot.mode !== "typewriter" ||
    snapshot.completed === true
  ) {
    return null;
  }

  return snapshot;
};

export const canResumeTextReveal = (container) =>
  Boolean(getResumableTypewriterSnapshot(container));

export const clearTextRevealingContainer = (container) => {
  if (container[TEXT_REVEAL_RUNTIME]) {
    const cleanup = container[TEXT_REVEAL_RUNTIME];

    delete container[TEXT_REVEAL_RUNTIME];
    cleanup();
  }

  delete container[TEXT_REVEAL_SNAPSHOT];
  container.onRender = undefined;

  const children = container.removeChildren();

  children.forEach((child) => {
    child.destroy({ children: true });
  });
};

const createPartObjects = (part, textValue = "", furiganaValue = "") => {
  const textStyle = new TextStyle(toPixiTextStyle(part.textStyle));
  const text = new Text({
    text: textValue,
    style: textStyle,
    x: Math.round(part.x),
    y: Math.round(part.y),
  });

  let furiganaText = null;

  if (part.furigana) {
    const furiganaTextStyle = new TextStyle(
      toPixiTextStyle(part.furigana.textStyle),
    );

    furiganaText = new Text({
      text: furiganaValue,
      style: furiganaTextStyle,
      x: Math.round(part.furigana.x),
      y: Math.round(part.furigana.y),
    });
  }

  return { text, furiganaText };
};

const buildFullTextContent = (contentContainer, element) => {
  let lastTextObject = null;
  let lastChunk = null;
  let totalCharacters = 0;
  let maxLineHeight = 0;
  const lines = [];

  for (let chunkIndex = 0; chunkIndex < element.content.length; chunkIndex++) {
    const chunk = element.content[chunkIndex];
    const lineContainer = new Container({
      label: `${element.id}-line-${chunkIndex}`,
    });
    const lineObjects = [];
    let lineLastTextObject = null;
    let lineCharacterCount = 0;

    contentContainer.addChild(lineContainer);
    lastChunk = chunk;
    maxLineHeight = Math.max(maxLineHeight, chunk.lineMaxHeight ?? 0);

    for (let partIndex = 0; partIndex < chunk.lineParts.length; partIndex++) {
      const part = chunk.lineParts[partIndex];
      const { text, furiganaText } = createPartObjects(
        part,
        part.text,
        part.furigana?.text || "",
      );

      if (furiganaText) {
        lineContainer.addChild(furiganaText);
        lineObjects.push(furiganaText);
      }

      lineContainer.addChild(text);
      lineObjects.push(text);

      lastTextObject = text;
      lineLastTextObject = text;
      totalCharacters += part.text.length;
      lineCharacterCount += part.text.length;
    }

    if (lineObjects.length > 0) {
      const lineBounds = lineContainer.getLocalBounds();

      lines.push({
        chunk,
        container: lineContainer,
        lastTextObject: lineLastTextObject,
        totalCharacters: lineCharacterCount,
        bounds: {
          x: lineBounds.x,
          y: lineBounds.y,
          width: lineBounds.width,
          height: lineBounds.height,
        },
      });
    } else {
      lineContainer.destroy();
    }
  }

  return {
    lines,
    lastTextObject,
    lastChunk,
    totalCharacters,
    maxLineHeight,
    bounds: contentContainer.getLocalBounds(),
  };
};

const runNoneReveal = ({ contentContainer, indicatorSprite, element }) => {
  const indicatorOffset = element?.indicator?.offset ?? 12;
  const { lastTextObject, lastChunk } = buildFullTextContent(
    contentContainer,
    element,
  );

  positionIndicatorForChunk(indicatorSprite, lastChunk, indicatorOffset);
  positionIndicatorAtTextEnd(indicatorSprite, lastTextObject, indicatorOffset);
  applyCompleteIndicator(indicatorSprite, element);
};

const runTypewriterPrefixReveal = ({
  contentContainer,
  indicatorSprite,
  element,
  revealedCharacters,
}) => {
  const indicatorOffset = element?.indicator?.offset ?? 12;
  const firstChunk = element.content[0] ?? null;
  const totalCharacters = getTextRevealCharacterCount(element);
  let remainingCharacters = Math.min(
    revealedCharacters,
    Math.max(0, totalCharacters),
  );
  let lastVisibleTextObject = null;
  let lastVisibleChunk = null;

  if (remainingCharacters <= 0) {
    positionIndicatorForChunk(indicatorSprite, firstChunk, indicatorOffset);
    return;
  }

  chunkLoop: for (
    let chunkIndex = 0;
    chunkIndex < element.content.length;
    chunkIndex++
  ) {
    const chunk = element.content[chunkIndex];

    for (let partIndex = 0; partIndex < chunk.lineParts.length; partIndex++) {
      const part = chunk.lineParts[partIndex];
      const prefilledCharacters = Math.min(
        part.text.length,
        remainingCharacters,
      );

      if (prefilledCharacters <= 0) {
        break chunkLoop;
      }

      const fullFurigana = part.furigana?.text || "";
      const furiganaLength = fullFurigana.length;
      const prefilledFuriganaLength =
        part.text.length > 0
          ? Math.round(
              (prefilledCharacters / part.text.length) * furiganaLength,
            )
          : 0;
      const { text, furiganaText } = createPartObjects(
        part,
        part.text.substring(0, prefilledCharacters),
        fullFurigana.substring(0, prefilledFuriganaLength),
      );

      if (furiganaText) {
        contentContainer.addChild(furiganaText);
      }

      contentContainer.addChild(text);
      lastVisibleTextObject = text;
      lastVisibleChunk = chunk;
      remainingCharacters -= prefilledCharacters;

      if (prefilledCharacters < part.text.length) {
        break chunkLoop;
      }
    }
  }

  if (lastVisibleChunk) {
    positionIndicatorForChunk(
      indicatorSprite,
      lastVisibleChunk,
      indicatorOffset,
    );
    positionIndicatorAtTextEnd(
      indicatorSprite,
      lastVisibleTextObject,
      indicatorOffset,
    );
  } else {
    positionIndicatorForChunk(indicatorSprite, firstChunk, indicatorOffset);
  }

  if (revealedCharacters >= totalCharacters) {
    applyCompleteIndicator(indicatorSprite, element);
  }
};

const runPausedInitialReveal = ({
  contentContainer,
  indicatorSprite,
  element,
}) => {
  const revealedCharacters = getInitialRevealedCharacters(element);

  if (revealedCharacters <= 0) {
    const indicatorOffset = element?.indicator?.offset ?? 12;
    const firstChunk = element.content[0] ?? null;

    positionIndicatorForChunk(indicatorSprite, firstChunk, indicatorOffset);
    return;
  }

  if (element.revealEffect === "softWipe") {
    runSoftWipePausedInitialReveal({
      contentContainer,
      indicatorSprite,
      element,
      revealedCharacters,
    });
  } else {
    runTypewriterPrefixReveal({
      contentContainer,
      indicatorSprite,
      element,
      revealedCharacters,
    });
  }
};

const runTypewriterReveal = async ({
  contentContainer,
  indicatorSprite,
  element,
  signal,
  startAtCharacter = 0,
  snapshot = null,
}) => {
  const effectiveSpeed = getEffectiveSpeed(element.speed ?? 50);
  const indicatorOffset = element?.indicator?.offset ?? 12;
  const charDelay = Math.max(1, Math.floor(1000 / effectiveSpeed));
  const chunkDelay = Math.max(1, Math.floor(4000 / effectiveSpeed));
  let remainingStartCharacters = Math.max(0, Math.floor(startAtCharacter));

  if (snapshot) {
    snapshot.revealedCharacters = remainingStartCharacters;
    snapshot.completed = false;
  }

  for (let chunkIndex = 0; chunkIndex < element.content.length; chunkIndex++) {
    if (signal?.aborted || contentContainer.destroyed) return false;

    const chunk = element.content[chunkIndex];
    let revealedNewCharactersInChunk = false;

    positionIndicatorForChunk(indicatorSprite, chunk, indicatorOffset);

    for (let partIndex = 0; partIndex < chunk.lineParts.length; partIndex++) {
      if (signal?.aborted || contentContainer.destroyed) return false;

      const part = chunk.lineParts[partIndex];
      const { text, furiganaText } = createPartObjects(part);

      if (furiganaText) {
        contentContainer.addChild(furiganaText);
      }

      contentContainer.addChild(text);

      const fullText = part.text;
      const fullFurigana = part.furigana?.text || "";
      const furiganaLength = fullFurigana.length;
      const prefilledCharacters = Math.min(
        fullText.length,
        remainingStartCharacters,
      );
      const prefilledFuriganaLength =
        fullText.length > 0
          ? Math.round((prefilledCharacters / fullText.length) * furiganaLength)
          : 0;

      text.text = fullText.substring(0, prefilledCharacters);
      if (furiganaText) {
        furiganaText.text = fullFurigana.substring(0, prefilledFuriganaLength);
      }

      remainingStartCharacters -= prefilledCharacters;

      if (prefilledCharacters > 0) {
        indicatorSprite.x =
          getCharacterXPositionInATextObject(text, prefilledCharacters - 1) +
          indicatorOffset;
      }

      for (
        let charIndex = prefilledCharacters;
        charIndex < fullText.length;
        charIndex++
      ) {
        if (signal?.aborted || contentContainer.destroyed) return false;

        text.text = fullText.substring(0, charIndex + 1);
        indicatorSprite.x =
          getCharacterXPositionInATextObject(text, charIndex) + indicatorOffset;
        revealedNewCharactersInChunk = true;

        if (snapshot) {
          snapshot.revealedCharacters += 1;
        }

        if (furiganaText) {
          const furiganaProgress = Math.round(
            ((charIndex + 1) / fullText.length) * furiganaLength,
          );

          furiganaText.text = fullFurigana.substring(0, furiganaProgress);
        }

        if (charIndex < fullText.length - 1) {
          await abortableSleep(charDelay, signal);
        }
      }
    }

    if (
      chunkIndex < element.content.length - 1 &&
      revealedNewCharactersInChunk
    ) {
      await abortableSleep(chunkDelay, signal);
    }
  }

  applyCompleteIndicator(indicatorSprite, element);

  if (snapshot) {
    snapshot.completed = true;
  }

  return true;
};

const createSoftWipeLineTimings = ({
  lines,
  edgeWidth,
  baseDuration,
  softWipe,
}) => {
  const lineWeights = lines.map((line) => {
    const baseWeight = Math.max(1, line.totalCharacters);
    const tailFactor = 1 + edgeWidth / Math.max(1, line.bounds.width);

    return baseWeight * tailFactor;
  });
  const totalWeight = lineWeights.reduce((sum, weight) => sum + weight, 0);
  const timedLines = [];
  let nextStartTime = 0;
  let totalDuration = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const weight = lineWeights[lineIndex];
    const duration =
      totalWeight > 0
        ? Math.max(1, (baseDuration * weight) / totalWeight)
        : baseDuration;
    const startTime = Math.max(0, nextStartTime);
    const endTime = startTime + duration;

    timedLines.push({
      ...lines[lineIndex],
      startTime,
      endTime,
      duration,
    });

    totalDuration = Math.max(totalDuration, endTime);
    nextStartTime =
      endTime - duration * softWipe.lineOverlap + softWipe.lineDelay;
  }

  return {
    timedLines,
    duration: Math.max(1, Math.ceil(totalDuration)),
  };
};

const getSoftWipeLineProgress = ({ currentTime, line, easing }) => {
  const rawProgress =
    line.duration > 0 ? (currentTime - line.startTime) / line.duration : 1;

  return easing(Math.max(0, Math.min(rawProgress, 1)));
};

const getInverseSoftWipeProgress = ({ progress, easingName }) => {
  const clampedProgress = clamp(progress, 0, 1);

  if (easingName === "easeOutCubic") {
    return 1 - Math.cbrt(1 - clampedProgress);
  }

  return clampedProgress;
};

const createSoftWipeInitialTimeline = ({
  timedLines,
  initialRevealedCharacters,
  softWipe,
  easingName,
}) => {
  let remainingCharacters = Math.max(0, Math.floor(initialRevealedCharacters));
  let reachedRevealBoundary = remainingCharacters <= 0;
  let nextStartTime = 0;
  let totalDuration = 0;

  const adjustedTimedLines = timedLines.map((line) => {
    const lineCharacters = Math.max(0, line.totalCharacters ?? 0);
    let rawInitialProgress = 0;
    let completedByInitialReveal = false;

    if (!reachedRevealBoundary && remainingCharacters > 0) {
      if (lineCharacters <= 0 || remainingCharacters >= lineCharacters) {
        remainingCharacters -= lineCharacters;
        rawInitialProgress = 1;
        completedByInitialReveal = true;
      } else {
        const easedProgress = remainingCharacters / lineCharacters;

        rawInitialProgress = getInverseSoftWipeProgress({
          progress: easedProgress,
          easingName,
        });
        remainingCharacters = 0;
        reachedRevealBoundary = true;
      }
    }

    if (completedByInitialReveal) {
      return {
        ...line,
        startTime: -line.duration,
        endTime: 0,
      };
    }

    reachedRevealBoundary = true;

    const startTime =
      rawInitialProgress > 0
        ? -rawInitialProgress * line.duration
        : Math.max(0, nextStartTime);
    const endTime = startTime + line.duration;

    totalDuration = Math.max(totalDuration, endTime);
    nextStartTime =
      endTime - line.duration * softWipe.lineOverlap + softWipe.lineDelay;

    return {
      ...line,
      startTime,
      endTime,
    };
  });

  return {
    timedLines: adjustedTimedLines,
    duration: Math.max(1, Math.ceil(totalDuration)),
  };
};

const destroySoftWipeLineMasks = (lineMasks) => {
  lineMasks.forEach((lineMask) => {
    if (!lineMask) {
      return;
    }

    if (lineMask.line.container.mask === lineMask.sprite) {
      lineMask.line.container.mask = null;
    }

    if (lineMask.sprite.parent) {
      lineMask.sprite.parent.removeChild(lineMask.sprite);
    }

    lineMask.sprite.destroy();
    lineMask.texture.destroy(true);
  });
};

const createSoftWipeLineMasks = ({
  contentContainer,
  timedLines,
  edgeWidth,
}) => {
  const lineMasks = timedLines.map((line) => {
    const canvas = document.createElement("canvas");

    canvas.width = Math.max(1, Math.ceil(line.bounds.width + edgeWidth));
    canvas.height = Math.max(1, Math.ceil(line.bounds.height));

    const context = canvas.getContext("2d");

    if (!context) {
      return null;
    }

    const texture = getCanvasTexture(canvas);
    const sprite = new Sprite(texture);

    sprite.x = Math.floor(line.bounds.x - edgeWidth);
    sprite.y = Math.floor(line.bounds.y);
    line.container.mask = sprite;
    contentContainer.addChild(sprite);

    return {
      canvas,
      context,
      texture,
      sprite,
      line,
      edgeWidth,
    };
  });

  if (lineMasks.some((lineMask) => lineMask === null)) {
    destroySoftWipeLineMasks(lineMasks);
    return null;
  }

  return lineMasks;
};

const applySoftWipeFrame = ({
  timedLines,
  lineMasks,
  easing,
  indicatorSprite,
  indicatorOffset,
  currentTime,
}) => {
  let activeLine = timedLines[0];
  let activeLineLeadingEdgeX = activeLine.bounds.x;

  for (let lineIndex = 0; lineIndex < timedLines.length; lineIndex++) {
    const line = timedLines[lineIndex];
    const lineMask = lineMasks[lineIndex];
    const lineProgress = getSoftWipeLineProgress({
      currentTime,
      line,
      easing,
    });
    const { context, canvas, texture } = lineMask;

    context.clearRect(0, 0, canvas.width, canvas.height);

    if (lineProgress <= 0) {
      texture.source.update();
      continue;
    }

    const lineY = 0;
    const lineTravelDistance = line.bounds.width + lineMask.edgeWidth;
    const lineStart = lineMask.edgeWidth;
    const lineLeadingEdge = lineStart + lineProgress * lineTravelDistance;
    const hardEnd = Math.max(lineStart, lineLeadingEdge - lineMask.edgeWidth);

    if (hardEnd > lineStart) {
      context.fillStyle = "#ffffff";
      context.fillRect(
        lineStart,
        lineY,
        Math.min(hardEnd - lineStart, line.bounds.width),
        line.bounds.height,
      );
    }

    const gradientStart = Math.max(
      lineStart,
      lineLeadingEdge - lineMask.edgeWidth,
    );
    const gradientEnd = Math.min(
      lineStart + line.bounds.width,
      lineLeadingEdge,
    );

    if (gradientEnd > gradientStart) {
      const gradient = context.createLinearGradient(
        gradientStart,
        0,
        gradientEnd,
        0,
      );

      gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      context.fillStyle = gradient;
      context.fillRect(
        gradientStart,
        lineY,
        gradientEnd - gradientStart,
        line.bounds.height,
      );
    }

    texture.source.update();
    activeLine = line;
    activeLineLeadingEdgeX =
      line.bounds.x +
      Math.min(line.bounds.width, Math.max(0, lineLeadingEdge - lineStart));
  }

  positionIndicatorForChunk(indicatorSprite, activeLine.chunk, indicatorOffset);
  indicatorSprite.x = activeLineLeadingEdgeX + indicatorOffset;
};

const runSoftWipePausedInitialReveal = ({
  contentContainer,
  indicatorSprite,
  element,
  revealedCharacters,
}) => {
  const indicatorOffset = element?.indicator?.offset ?? 12;
  const { lines, lastTextObject, lastChunk, totalCharacters, maxLineHeight } =
    buildFullTextContent(contentContainer, element);

  positionIndicatorForChunk(indicatorSprite, lastChunk, indicatorOffset);

  if (
    lines.length === 0 ||
    totalCharacters === 0 ||
    revealedCharacters >= totalCharacters ||
    !lines.some((line) => line.bounds.width > 0 && line.bounds.height > 0) ||
    !globalThis.document
  ) {
    positionIndicatorAtTextEnd(
      indicatorSprite,
      lastTextObject,
      indicatorOffset,
    );
    applyCompleteIndicator(indicatorSprite, element);
    return;
  }

  const softWipe = normalizeSoftWipeConfig(element.softWipe);
  const easing = getSoftWipeEasing(softWipe.easing);
  const edgeWidth = getSoftWipeEdgeWidth({ maxLineHeight, softWipe });
  const effectiveSpeed = getEffectiveSpeed(element.speed ?? 50);
  const baseDuration = Math.max(
    1,
    Math.round((totalCharacters / effectiveSpeed) * 1000),
  );
  const baseTimeline = createSoftWipeLineTimings({
    lines,
    edgeWidth,
    baseDuration,
    softWipe,
  });
  const { timedLines } = createSoftWipeInitialTimeline({
    timedLines: baseTimeline.timedLines,
    initialRevealedCharacters: revealedCharacters,
    softWipe,
    easingName: softWipe.easing,
  });

  const lineMasks = createSoftWipeLineMasks({
    contentContainer,
    timedLines,
    edgeWidth,
  });

  if (!lineMasks) {
    positionIndicatorAtTextEnd(
      indicatorSprite,
      lastTextObject,
      indicatorOffset,
    );
    applyCompleteIndicator(indicatorSprite, element);
    return;
  }

  applySoftWipeFrame({
    timedLines,
    lineMasks,
    easing,
    indicatorSprite,
    indicatorOffset,
    currentTime: 0,
  });
};

const runSoftWipeReveal = ({
  container,
  contentContainer,
  indicatorSprite,
  element,
  animationBus,
  completionTracker,
}) => {
  const indicatorOffset = element?.indicator?.offset ?? 12;
  const effectiveSpeed = getEffectiveSpeed(element.speed ?? 50);
  const { lines, lastTextObject, lastChunk, totalCharacters, maxLineHeight } =
    buildFullTextContent(contentContainer, element);

  const initialRevealedCharacters = getInitialRevealedCharacters(element);

  positionIndicatorForChunk(indicatorSprite, lastChunk, indicatorOffset);

  if (
    lines.length === 0 ||
    totalCharacters === 0 ||
    initialRevealedCharacters >= totalCharacters ||
    !lines.some((line) => line.bounds.width > 0 && line.bounds.height > 0) ||
    !globalThis.document ||
    !animationBus
  ) {
    positionIndicatorAtTextEnd(
      indicatorSprite,
      lastTextObject,
      indicatorOffset,
    );
    applyCompleteIndicator(indicatorSprite, element);
    return false;
  }

  const softWipe = normalizeSoftWipeConfig(element.softWipe);
  const easing = getSoftWipeEasing(softWipe.easing);
  const edgeWidth = getSoftWipeEdgeWidth({ maxLineHeight, softWipe });
  const baseDuration = Math.max(
    1,
    Math.round((totalCharacters / effectiveSpeed) * 1000),
  );
  const baseTimeline = createSoftWipeLineTimings({
    lines,
    edgeWidth,
    baseDuration,
    softWipe,
  });
  const { timedLines, duration } = createSoftWipeInitialTimeline({
    timedLines: baseTimeline.timedLines,
    initialRevealedCharacters,
    softWipe,
    easingName: softWipe.easing,
  });

  const stateVersion = completionTracker.getVersion();
  const animationId = `${element.id}-soft-wipe`;
  const lineMasks = createSoftWipeLineMasks({
    contentContainer,
    timedLines,
    edgeWidth,
  });

  if (!lineMasks) {
    positionIndicatorAtTextEnd(
      indicatorSprite,
      lastTextObject,
      indicatorOffset,
    );
    applyCompleteIndicator(indicatorSprite, element);
    return false;
  }

  let finalized = false;

  const finalize = (completed) => {
    if (finalized) {
      return;
    }

    finalized = true;

    if (container[TEXT_REVEAL_RUNTIME] === finalizeCleanup) {
      delete container[TEXT_REVEAL_RUNTIME];
    }

    lineMasks.forEach((lineMask) => {
      if (lineMask.line.container.mask === lineMask.sprite) {
        lineMask.line.container.mask = null;
      }

      if (lineMask.sprite.parent) {
        lineMask.sprite.parent.removeChild(lineMask.sprite);
      }

      lineMask.sprite.destroy();
      lineMask.texture.destroy(true);
    });

    if (completed) {
      positionIndicatorAtTextEnd(
        indicatorSprite,
        lastTextObject,
        indicatorOffset,
      );
      applyCompleteIndicator(indicatorSprite, element);
    }
  };

  const finalizeCleanup = () => {
    animationBus.dispatch({
      type: "CANCEL",
      id: animationId,
    });
    finalize(false);
  };

  registerTextRevealRuntime(container, finalizeCleanup);
  completionTracker.track(stateVersion);

  animationBus.dispatch({
    type: "START",
    payload: {
      id: animationId,
      driver: "custom",
      duration,
      applyFrame: (currentTime) => {
        applySoftWipeFrame({
          timedLines,
          lineMasks,
          easing,
          indicatorSprite,
          indicatorOffset,
          currentTime: Math.min(duration, currentTime),
        });
      },
      applyTargetState: () => {
        finalize(false);
      },
      onComplete: () => {
        completionTracker.complete(stateVersion);
        finalize(true);
      },
      onCancel: () => {
        completionTracker.complete(stateVersion);
        finalize(false);
      },
      isValid: () =>
        Boolean(container) &&
        !container.destroyed &&
        !contentContainer.destroyed &&
        !indicatorSprite.destroyed,
    },
  });

  return true;
};

export const runTextReveal = async ({
  container,
  element,
  completionTracker,
  animationBus,
  zIndex,
  signal,
  playback = "autoplay",
}) => {
  if (signal?.aborted || container.destroyed) {
    return;
  }

  const renderImmediately = shouldRenderTextRevealImmediately(element);
  const resumableSnapshot =
    playback === "resume" ? getResumableTypewriterSnapshot(container) : null;
  const initialRevealedCharacters = getInitialRevealedCharacters(element);

  if (playback === "resume" && !resumableSnapshot) {
    return;
  }

  clearTextRevealingContainer(container);
  container.zIndex = zIndex;

  const contentContainer = new Container({ label: `${element.id}-content` });
  const indicatorSprite = createIndicatorSprite(element);

  container.addChild(contentContainer);
  container.addChild(indicatorSprite);

  try {
    if (playback === "paused-initial") {
      if (!renderImmediately) {
        setTextRevealSnapshot(container, {
          mode: getTextRevealSnapshotMode(element),
          revealedCharacters: initialRevealedCharacters,
          completed: false,
        });
      }

      if (renderImmediately) {
        setTextRevealSnapshot(container, {
          mode: "none",
          completed: true,
        });
        runNoneReveal({ contentContainer, indicatorSprite, element });
      } else {
        runPausedInitialReveal({ contentContainer, indicatorSprite, element });
      }
      return;
    }

    const stateVersion = completionTracker.getVersion();
    let completed = false;

    if (renderImmediately) {
      completionTracker.track(stateVersion);
      setTextRevealSnapshot(container, {
        mode: "none",
        completed: true,
      });
      runNoneReveal({ contentContainer, indicatorSprite, element });
      completed = true;
    } else if (element.revealEffect === "softWipe") {
      setTextRevealSnapshot(container, {
        mode: "softWipe",
        revealedCharacters: initialRevealedCharacters,
        completed: false,
      });

      const dispatched = runSoftWipeReveal({
        container,
        contentContainer,
        indicatorSprite,
        element,
        animationBus,
        completionTracker,
      });

      if (!dispatched && !signal?.aborted && !container.destroyed) {
        completionTracker.track(stateVersion);
        completed = true;
      } else {
        return;
      }
    } else {
      completionTracker.track(stateVersion);
      const startAtCharacter =
        resumableSnapshot?.revealedCharacters ?? initialRevealedCharacters;
      const nextSnapshot = setTextRevealSnapshot(container, {
        mode: "typewriter",
        revealedCharacters: startAtCharacter,
        completed: false,
      });

      completed = await runTypewriterReveal({
        contentContainer,
        indicatorSprite,
        element,
        signal,
        startAtCharacter,
        snapshot: nextSnapshot,
      });
    }

    if (completed && !signal?.aborted && !container.destroyed) {
      completionTracker.complete(stateVersion);
    }
  } catch (error) {
    if (error?.name !== "AbortError" && !signal?.aborted) {
      throw error;
    }
  }
};
