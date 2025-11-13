import { Text, TextStyle, Container } from "pixi.js";

/**
 * Sleep utility for delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after delay
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Simple render function for text-revealing elements
 * @param {Object} params - Render parameters
 * @param {Object} params.app - PIXI application
 * @param {Object} params.parent - Parent container
 * @param {Object} params.textRevealingASTNode - Text-revealing element with parsed content chunks
 * @param {AbortSignal} params.signal - Optional abort signal
 */
export const updateTextRevealing = async (params) => {
  const { app, parent, textRevealingASTNode, signal } = params;

  const speed = textRevealingASTNode.speed ?? 50;
  const revealEffect = textRevealingASTNode.revealEffect ?? "typewriter";

  // Calculate delays based on speed (inverse relationship - higher speed = shorter delay)
  const skipAnimations = revealEffect === "none";
  const charDelay = skipAnimations ? 0 : Math.max(1, Math.floor(1000 / speed));
  const chunkDelay = skipAnimations ? 0 : Math.max(1, Math.floor(4000 / speed));

  // Check if aborted
  if (signal?.aborted) return;

  const textRevealingElement = parent.children.find(
    (child) => child.label === textRevealingASTNode.id,
  );
  if (textRevealingElement) {
    textRevealingElement.removeChildren();

    if (textRevealingASTNode.x !== undefined)
      textRevealingElement.x = textRevealingASTNode.x;
    if (textRevealingASTNode.y !== undefined)
      textRevealingElement.y = textRevealingASTNode.y;
    if (textRevealingASTNode.alpha !== undefined)
      textRevealingElement.alpha = textRevealingASTNode.alpha;

    // Process each chunk sequentially
    for (
      let chunkIndex = 0;
      chunkIndex < textRevealingASTNode.content.length;
      chunkIndex++
    ) {
      if (signal?.aborted) return;

      const chunk = textRevealingASTNode.content[chunkIndex];

      // Process each line part in the chunk
      for (let partIndex = 0; partIndex < chunk.lineParts.length; partIndex++) {
        if (signal?.aborted) return;

        const part = chunk.lineParts[partIndex];

        // Create text objects for this part
        const textStyle = new TextStyle(part.textStyle);
        const text = new Text({
          text: "",
          style: textStyle,
          x: part.x,
          y: part.y,
        });

        let furiganaText = null;
        if (part.furigana) {
          const furiganaTextStyle = new TextStyle(part.furigana.textStyle);
          furiganaText = new Text({
            text: "",
            style: furiganaTextStyle,
            x: part.furigana.x,
            y: part.furigana.y,
          });
          textRevealingElement.addChild(furiganaText);
        }

        textRevealingElement.addChild(text);
        // Reveal text character by character or all at once if skipping animations
        const fullText = part.text;
        const fullFurigana = part.furigana?.text || "";

        if (skipAnimations) {
          text.text = fullText;
          if (furiganaText) {
            furiganaText.text = fullFurigana;
          }
        } else {
          // Animate character by character
          const furiganaLength = fullFurigana.length;

          for (let charIndex = 0; charIndex < fullText.length; charIndex++) {
            if (signal?.aborted) return;

            // Add current character to text
            text.text = fullText.substring(0, charIndex + 1);

            // Calculate how much furigana to show based on text progress
            const furiganaProgress = Math.round(
              ((charIndex + 1) / fullText.length) * furiganaLength,
            );
            if (furiganaText) {
              furiganaText.text = fullFurigana.substring(0, furiganaProgress);
            }

            // Wait before adding next character
            if (charIndex < fullText.length - 1) {
              // Don't wait after last character
              await sleep(charDelay);
            }
          }
        }
      }

      // Wait before processing next chunk (except for the last chunk)
      if (chunkIndex < textRevealingASTNode.content.length - 1) {
        await sleep(chunkDelay);
      }
    }
  }
}
