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

const TEXT_REVEAL_RUNTIME = Symbol("textRevealRuntime");
const MIN_SOFT_WIPE_EDGE = 18;
const MAX_SOFT_WIPE_EDGE = 64;
const SOFT_WIPE_EDGE_MULTIPLIER = 1.25;

const getEffectiveSpeed = (speed) =>
  typeof speed === "number" && speed > 0 ? speed : 1;

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

export const clearTextRevealingContainer = (container) => {
  if (container[TEXT_REVEAL_RUNTIME]) {
    const cleanup = container[TEXT_REVEAL_RUNTIME];

    delete container[TEXT_REVEAL_RUNTIME];
    cleanup();
  }

  container.onRender = undefined;

  const children = container.removeChildren();

  children.forEach((child) => {
    child.destroy({ children: true });
  });
};

const createPartObjects = (part, textValue = "", furiganaValue = "") => {
  const textStyle = new TextStyle(part.textStyle);
  const text = new Text({
    text: textValue,
    style: textStyle,
    x: Math.round(part.x),
    y: Math.round(part.y),
  });

  let furiganaText = null;

  if (part.furigana) {
    const furiganaTextStyle = new TextStyle(part.furigana.textStyle);

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

const runPausedInitialReveal = ({ indicatorSprite, element }) => {
  const indicatorOffset = element?.indicator?.offset ?? 12;
  const firstChunk = element.content[0] ?? null;

  positionIndicatorForChunk(indicatorSprite, firstChunk, indicatorOffset);
};

const runTypewriterReveal = async ({
  contentContainer,
  indicatorSprite,
  element,
  signal,
}) => {
  const effectiveSpeed = getEffectiveSpeed(element.speed ?? 50);
  const indicatorOffset = element?.indicator?.offset ?? 12;
  const charDelay = Math.max(1, Math.floor(1000 / effectiveSpeed));
  const chunkDelay = Math.max(1, Math.floor(4000 / effectiveSpeed));

  for (let chunkIndex = 0; chunkIndex < element.content.length; chunkIndex++) {
    if (signal?.aborted || contentContainer.destroyed) return false;

    const chunk = element.content[chunkIndex];

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

      for (let charIndex = 0; charIndex < fullText.length; charIndex++) {
        if (signal?.aborted || contentContainer.destroyed) return false;

        text.text = fullText.substring(0, charIndex + 1);
        indicatorSprite.x =
          getCharacterXPositionInATextObject(text, charIndex) + indicatorOffset;

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

    if (chunkIndex < element.content.length - 1) {
      await abortableSleep(chunkDelay, signal);
    }
  }

  applyCompleteIndicator(indicatorSprite, element);

  return true;
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
  const {
    lines,
    lastTextObject,
    lastChunk,
    totalCharacters,
    maxLineHeight,
    bounds,
  } = buildFullTextContent(contentContainer, element);

  positionIndicatorForChunk(indicatorSprite, lastChunk, indicatorOffset);

  if (
    lines.length === 0 ||
    totalCharacters === 0 ||
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

  const edgeWidth = Math.max(
    MIN_SOFT_WIPE_EDGE,
    Math.min(
      MAX_SOFT_WIPE_EDGE,
      Math.round(maxLineHeight * SOFT_WIPE_EDGE_MULTIPLIER),
    ),
  );
  const duration = Math.max(
    1,
    Math.round((totalCharacters / effectiveSpeed) * 1000),
  );
  const lineWeights = lines.map((line) => {
    const baseWeight = Math.max(1, line.totalCharacters);
    const tailFactor = 1 + edgeWidth / Math.max(1, line.bounds.width);

    return baseWeight * tailFactor;
  });
  const totalWeight = lineWeights.reduce((sum, weight) => sum + weight, 0);
  const timedLines = [];
  let accumulatedWeight = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const weight = lineWeights[lineIndex];
    const start = totalWeight > 0 ? accumulatedWeight / totalWeight : 0;

    accumulatedWeight += weight;

    timedLines.push({
      ...lines[lineIndex],
      startProgress: start,
      endProgress: totalWeight > 0 ? accumulatedWeight / totalWeight : 1,
    });
  }

  const stateVersion = completionTracker.getVersion();
  const animationId = `${element.id}-soft-wipe`;
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
    };
  });

  if (lineMasks.some((lineMask) => lineMask === null)) {
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
        const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 1;
        let activeLine = timedLines[0];
        let activeLineProgress = 0;

        for (let lineIndex = 0; lineIndex < timedLines.length; lineIndex++) {
          const line = timedLines[lineIndex];
          const lineMask = lineMasks[lineIndex];
          const lineSpan = Math.max(
            0.000001,
            line.endProgress - line.startProgress,
          );
          const lineProgress = Math.max(
            0,
            Math.min((progress - line.startProgress) / lineSpan, 1),
          );
          const { context, canvas, texture } = lineMask;

          context.clearRect(0, 0, canvas.width, canvas.height);

          if (lineProgress <= 0) {
            texture.source.update();
            continue;
          }

          const lineStart = edgeWidth;
          const lineY = 0;
          const lineTravelDistance = line.bounds.width + edgeWidth;
          const lineLeadingEdge = lineStart + lineProgress * lineTravelDistance;
          const hardEnd = Math.max(lineStart, lineLeadingEdge - edgeWidth);

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
            lineLeadingEdge - edgeWidth,
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

          if (lineProgress < 1 || lineIndex === timedLines.length - 1) {
            activeLine = line;
            activeLineProgress = Math.min(
              1,
              (lineLeadingEdge - lineStart) / Math.max(1, line.bounds.width),
            );
          }
        }

        positionIndicatorForChunk(
          indicatorSprite,
          activeLine.chunk,
          indicatorOffset,
        );
        indicatorSprite.x =
          activeLine.bounds.x +
          Math.min(
            activeLine.bounds.width,
            activeLine.bounds.width * activeLineProgress,
          ) +
          indicatorOffset;
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

  clearTextRevealingContainer(container);
  container.zIndex = zIndex;

  const contentContainer = new Container({ label: `${element.id}-content` });
  const indicatorSprite = createIndicatorSprite(element);

  container.addChild(contentContainer);
  container.addChild(indicatorSprite);

  try {
    if (playback === "paused-initial") {
      if (element.revealEffect === "none") {
        runNoneReveal({ contentContainer, indicatorSprite, element });
      } else {
        runPausedInitialReveal({ indicatorSprite, element });
      }
      return;
    }

    if (element.revealEffect === "softWipe") {
      const dispatched = runSoftWipeReveal({
        container,
        contentContainer,
        indicatorSprite,
        element,
        animationBus,
        completionTracker,
      });

      if (!dispatched && !signal?.aborted && !container.destroyed) {
        const stateVersion = completionTracker.getVersion();

        completionTracker.track(stateVersion);
        completionTracker.complete(stateVersion);
      }

      return;
    }

    const stateVersion = completionTracker.getVersion();
    let completed = false;

    completionTracker.track(stateVersion);

    if (element.revealEffect === "none") {
      runNoneReveal({ contentContainer, indicatorSprite, element });
      completed = true;
    } else {
      completed = await runTypewriterReveal({
        contentContainer,
        indicatorSprite,
        element,
        signal,
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
