import { Text, TextStyle, Container } from "pixi.js";

/**
 * Simple render function for text-revealing elements
 * @param {Object} params - Render parameters
 * @param {Object} params.app - PIXI application
 * @param {Object} params.parent - Parent container
 * @param {Object} params.element - Text-revealing element with parsed content chunks
 * @param {AbortSignal} params.signal - Optional abort signal
 */
export async function renderTextRevealing(params) {
  const { app, parent, element, signal } = params;

  // Check if aborted
  if (signal?.aborted) return;

  const container = new Container();
  container.label = element.id;

  // Set container position
  if (element.x !== undefined) container.x = element.x;
  if (element.y !== undefined) container.y = element.y;
  if (element.alpha !== undefined) container.alpha = element.alpha;

  // Render each chunk (line)
  element.content.forEach((chunk) => {
    // Check if aborted during iteration
    if (signal?.aborted) return;

    const lineContainer = new Container();
    lineContainer.y = chunk.y;

    // Calculate max height for alignment in this line
    let maxHeight = 0;
    const textPositions = new Map();

    // First pass: render regular text and store positions
    chunk.lineParts.forEach((part) => {
      if (signal?.aborted) return;

      if (!part.isFurigana) {
        const textStyle = new TextStyle({
          wordWrap: false,
          align: "left",
          fill: part.style.fill,
          fontSize: part.style.fontSize,
          fontFamily: part.style.fontFamily || "Arial",
          lineHeight: part.style.lineHeight,
          whiteSpace: "pre",
          trim: false,
          stroke: part.style.strokeColor
            ? {
                color: part.style.strokeColor,
                width: part.style.strokeWidth,
              }
            : undefined,
        });

        const text = new Text({
          text: part.text,
          style: textStyle,
          x: part.x,
          y: part.y,
        });

        const measurements = text.getBounds();
        maxHeight = Math.max(maxHeight, measurements.height);

        // Store position for furigana calculation
        textPositions.set(part.x, {
          yOffset: part.y,
          height: measurements.height,
          width: measurements.width
        });

        lineContainer.addChild(text);
      }
    });

    // Second pass: render furigana
    chunk.lineParts.forEach((part) => {
      if (signal?.aborted) return;

      if (part.isFurigana) {
        const textStyle = new TextStyle({
          wordWrap: false,
          align: "left",
          fill: part.style.fill,
          fontSize: part.style.fontSize,
          fontFamily: part.style.fontFamily || "Arial",
          whiteSpace: "pre",
          trim: false,
        });

        const furiganaText = new Text({
          text: part.text,
          style: textStyle,
          x: part.x,
          y: part.y,
        });

        lineContainer.addChild(furiganaText);
      }
    });

    container.addChild(lineContainer);
  });

  // Final check before adding to parent
  if (!signal?.aborted) {
    parent.addChild(container);
  }
}