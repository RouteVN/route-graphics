import { Text, TextStyle, Container, Sprite, Texture } from "pixi.js";

/**
 * Sleep utility for delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after delay
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calculate and position indicator sprite (supports real-time updates)
 * @param {Sprite} indicatorSprite - The indicator sprite to position
 * @param {Array} completedChunks - Fully processed chunks
 * @param {Array} currentChunkParts - Current chunk parts with partially revealed text (optional)
 * @param {Object} textStyle - Default text style
 */
const positionIndicator = (
  indicatorSprite,
  completedChunks,
  currentChunkParts = [],
  textStyle,
) => {
  if (!indicatorSprite) return;

  // Calculate text bounds to position indicator at the end
  let maxX = 0;
  let maxY = 0;
  let lineHeight = textStyle.fontSize * (textStyle.lineHeight || 1.2);

  // Process completed chunks
  completedChunks.forEach((chunk) => {
    chunk.lineParts.forEach((part) => {
      const partWidth = part.x + part.text.length * (textStyle.fontSize * 0.6); // Rough character width estimation
      const partHeight = part.y + lineHeight;

      if (partWidth > maxX) maxX = partWidth;
      if (partHeight > maxY) maxY = partHeight;
    });
  });

  // Process current chunk parts (for real-time animation)
  currentChunkParts.forEach((part) => {
    const partWidth = part.x + part.text.length * (textStyle.fontSize * 0.6);
    const partHeight = part.y + lineHeight;

    if (partWidth > maxX) maxX = partWidth;
    if (partHeight > maxY) maxY = partHeight;
  });

  // Position indicator slightly to the right and bottom of text
  indicatorSprite.x = Math.round(maxX + 10);
  indicatorSprite.y = Math.round(maxY - indicatorSprite.height);
};

/**
 * Add text-revealing element to the stage
 * @param {import("../elementPlugin").AddElementOptions} params
 */
export const addTextRevealing = async ({ parent, element, signal }) => {
  if (signal?.aborted) return;

  const speed = element.speed ?? 50;
  const revealEffect = element.revealEffect ?? "typewriter";

  // Calculate delays based on speed (inverse relationship - higher speed = shorter delay)
  const skipAnimations = revealEffect === "none";
  const charDelay = skipAnimations ? 0 : Math.max(1, Math.floor(1000 / speed));
  const chunkDelay = skipAnimations ? 0 : Math.max(1, Math.floor(4000 / speed));

  // Check if aborted
  if (signal?.aborted) return;

  const container = new Container();
  container.label = element.id;

  if (element.x !== undefined) container.x = Math.round(element.x);
  if (element.y !== undefined) container.y = Math.round(element.y);
  if (element.alpha !== undefined) container.alpha = element.alpha;
  // Add container to parent immediately so it's visible
  parent.addChild(container);

  // Initialize indicator if specified
  let indicatorSprite = null;
  let isRevealing = !skipAnimations;
  if (element.indicator) {
    const { revealing } = element.indicator;
    const initialTexture = revealing?.src
      ? Texture.from(revealing.src)
      : Texture.EMPTY;
    indicatorSprite = new Sprite(initialTexture);

    // Set dimensions if provided
    if (revealing?.width) indicatorSprite.width = Math.round(revealing.width);
    if (revealing?.height)
      indicatorSprite.height = Math.round(revealing.height);

    indicatorSprite.visible = isRevealing;
    container.addChild(indicatorSprite);
  }

  // Process each chunk sequentially
  for (let chunkIndex = 0; chunkIndex < element.content.length; chunkIndex++) {
    if (signal?.aborted) return;

    const chunk = element.content[chunkIndex];
    const currentChunkParts = [];

    // Process each line part in the chunk
    for (let partIndex = 0; partIndex < chunk.lineParts.length; partIndex++) {
      if (signal?.aborted) return;

      const part = chunk.lineParts[partIndex];

      // Create text objects for this part
      const textStyle = new TextStyle(part.textStyle);
      const text = new Text({
        text: "",
        style: textStyle,
        x: Math.round(part.x),
        y: Math.round(part.y),
      });

      let furiganaText = null;
      if (part.furigana) {
        const furiganaTextStyle = new TextStyle(part.furigana.textStyle);
        furiganaText = new Text({
          text: "",
          style: furiganaTextStyle,
          x: Math.round(part.furigana.x),
          y: Math.round(part.furigana.y),
        });
        container.addChild(furiganaText);
      }

      container.addChild(text);

      // Reveal text character by character or all at once if skipping animations
      const fullText = part.text;
      const fullFurigana = part.furigana?.text || "";

      if (skipAnimations) {
        text.text = fullText;
        if (furiganaText) {
          furiganaText.text = fullFurigana;
        }
        // Store for final positioning
        currentChunkParts.push({
          ...part,
          text: fullText,
          furigana: part.furigana
            ? { ...part.furigana, text: fullFurigana }
            : undefined,
        });
      } else {
        // Animate character by character
        const furiganaLength = fullFurigana.length;

        for (let charIndex = 0; charIndex < fullText.length; charIndex++) {
          if (signal?.aborted) return;

          // Add current character to text
          const currentText = fullText.substring(0, charIndex + 1);
          text.text = currentText;

          // Calculate how much furigana to show based on text progress
          const furiganaProgress = Math.round(
            ((charIndex + 1) / fullText.length) * furiganaLength,
          );
          const currentFurigana = fullFurigana.substring(0, furiganaProgress);
          if (furiganaText) {
            furiganaText.text = currentFurigana;
          }

          // Update indicator position to follow current text progress
          if (indicatorSprite) {
            positionIndicator(
              indicatorSprite,
              element.content.slice(0, chunkIndex),
              [
                ...currentChunkParts,
                {
                  ...part,
                  text: currentText,
                  furigana: part.furigana
                    ? { ...part.furigana, text: currentFurigana }
                    : undefined,
                },
              ],
              element.textStyle || {},
            );
          }

          // Wait before adding next character
          if (charIndex < fullText.length - 1) {
            // Don't wait after last character
            await sleep(charDelay);
          }
        }

        // Store completed part for next iteration
        currentChunkParts.push({
          ...part,
          text: fullText,
          furigana: part.furigana
            ? { ...part.furigana, text: fullFurigana }
            : undefined,
        });
      }
    }

    // Wait before processing next chunk (except for the last chunk)
    if (chunkIndex < element.content.length - 1) {
      await sleep(chunkDelay);
    }
  }

  // Position and update indicator after all text is revealed
  if (indicatorSprite && element.indicator) {
    // Position the indicator relative to the final text layout
    positionIndicator(
      indicatorSprite,
      element.content,
      [],
      element.textStyle || {},
    );

    // Update to finished state if complete texture is available
    if (element.indicator.complete?.src) {
      indicatorSprite.texture = Texture.from(element.indicator.complete.src);

      // Update dimensions for complete state if provided
      if (element.indicator.complete.width) {
        indicatorSprite.width = Math.round(element.indicator.complete.width);
      }
      if (element.indicator.complete.height) {
        indicatorSprite.height = Math.round(element.indicator.complete.height);
      }
    }

    // Hide indicator if animations are skipped
    if (skipAnimations) {
      indicatorSprite.visible = false;
    }
  }
};
