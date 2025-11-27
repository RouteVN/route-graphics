import { Sprite, Text, TextStyle, Texture } from "pixi.js";
import { getCharacterXPositionInATextObject } from "../../../util/getCharacterXPositionInATextObject";
import cancellableTimeout from "../../../util/cancalleableTimeout";

/**
 * Simple render function for text-revealing elements
 * @param {import("../elementPlugin").UpdateElementOptions} params
 */
export const updateTextRevealing = async (params) => {
  const { parent, nextElement: element, signal } = params;

  const speed = element.speed ?? 50;
  const revealEffect = element.revealEffect ?? "typewriter";
  const indicatorOffset = element?.indicator?.offset ?? 12;

  // Calculate delays based on speed (inverse relationship - higher speed = shorter delay)
  const skipAnimations = revealEffect === "none";
  const charDelay = skipAnimations ? 0 : Math.max(1, Math.floor(1000 / speed));
  const chunkDelay = skipAnimations ? 0 : Math.max(1, Math.floor(4000 / speed));

  const textRevealingElement = parent.children.find(
    (child) => child.label === element.id,
  );
  if (textRevealingElement) {
    textRevealingElement.removeChildren();

    let indicatorSprite = new Sprite(Texture.EMPTY);
    if (element?.indicator?.revealing?.src) {
      const revealingTexture = element.indicator.revealing.src
        ? Texture.from(element.indicator.revealing.src)
        : Texture.EMPTY;
      indicatorSprite = new Sprite(revealingTexture);
      indicatorSprite.width =
        element.indicator.revealing.width ?? revealingTexture.width;
      indicatorSprite.height =
        element.indicator.revealing.height ?? revealingTexture.height;
    }
    textRevealingElement.addChild(indicatorSprite);

    if (element.x !== undefined) textRevealingElement.x = element.x;
    if (element.y !== undefined) textRevealingElement.y = element.y;
    if (element.alpha !== undefined) textRevealingElement.alpha = element.alpha;

    // Process each chunk sequentially
    for (
      let chunkIndex = 0;
      chunkIndex < element.content.length;
      chunkIndex++
    ) {
      const chunk = element.content[chunkIndex];
      indicatorSprite.x = indicatorOffset;
      indicatorSprite.y =
        chunk.y + (chunk.lineMaxHeight - indicatorSprite.height);

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

        if (skipAnimations || signal?.aborted) {
          text.text = fullText;
          indicatorSprite.x =
            getCharacterXPositionInATextObject(text, fullText.length - 1) +
            indicatorOffset;
          if (furiganaText) {
            furiganaText.text = fullFurigana;
          }
        } else {
          // Animate character by character
          const furiganaLength = fullFurigana.length;

          for (let charIndex = 0; charIndex < fullText.length; charIndex++) {
            // Add current character to text
            text.text = fullText.substring(0, charIndex + 1);

            indicatorSprite.x =
              getCharacterXPositionInATextObject(text, charIndex) +
              indicatorOffset;

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
              try {
                await cancellableTimeout(charDelay, signal);
              } catch {
                return;
              }
            }
          }
        }
      }

      // Wait before processing next chunk (except for the last chunk)
      if (chunkIndex < element.content.length - 1) {
        try {
          await cancellableTimeout(chunkDelay, signal);
        } catch {
          return;
        }
      }
    }

    if (element?.indicator?.complete?.src) {
      const completeTexture = element.indicator.complete.src
        ? Texture.from(element.indicator.complete.src)
        : Texture.EMPTY;
      indicatorSprite.texture = completeTexture;
      indicatorSprite.width =
        element.indicator.complete.width ?? completeTexture.width;
      indicatorSprite.height =
        element.indicator.complete.height ?? completeTexture.height;
    }
  }
};
