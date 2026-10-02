import { CanvasTextMetrics, Graphics } from "pixi.js";

const TEXT_UNDERLINE = Symbol("textUnderline");

const hasUnderline = (decoration) =>
  typeof decoration === "string" &&
  decoration.split(/\s+/).includes("underline");

const drawUnderline = (text, state) => {
  const style = text.style;
  const styleKey = style.styleKey;

  if (state.text === text.text && state.styleKey === styleKey) return;

  state.text = text.text;
  state.styleKey = styleKey;
  state.graphics.clear();

  if (!text.text) return;

  const metrics = CanvasTextMetrics.measureText(text.text, style);
  const strokeWidth = style._stroke?.width ?? 0;
  const lineThickness = Math.max(1, style.fontSize / 16);
  const lineShift = Math.max(
    0,
    (metrics.lineHeight - metrics.fontProperties.fontSize) / 2,
  );

  metrics.lineWidths.forEach((lineWidth, index) => {
    if (lineWidth <= 0) return;

    const alignmentOffset =
      style.align === "right"
        ? metrics.maxLineWidth - lineWidth
        : style.align === "center"
          ? (metrics.maxLineWidth - lineWidth) / 2
          : 0;
    const x = strokeWidth / 2 + alignmentOffset;
    const y = Math.max(
      0,
      Math.min(
        metrics.height - lineThickness,
        strokeWidth / 2 +
          index * metrics.lineHeight +
          metrics.fontProperties.ascent +
          lineShift +
          style.fontSize * 0.06,
      ),
    );

    state.graphics
      .rect(x, y, Math.min(lineWidth, metrics.width - x), lineThickness)
      .fill(style.fill);
  });
};

export const applyTextDecoration = (text, style) => {
  const existing = text[TEXT_UNDERLINE];

  if (!hasUnderline(style?.textDecoration)) {
    if (existing) {
      if (text.onRender === existing.onRender) {
        text.onRender = existing.previousOnRender;
      }
      existing.graphics.destroy();
      text.allowChildren = existing.previousAllowChildren;
      delete text[TEXT_UNDERLINE];
    }
    return;
  }

  if (existing) {
    drawUnderline(text, existing);
    return;
  }

  const state = {
    graphics: new Graphics(),
    previousAllowChildren: text.allowChildren,
    previousOnRender: text.onRender,
    text: null,
    styleKey: null,
  };

  text[TEXT_UNDERLINE] = state;
  text.allowChildren = true;
  text.addChild(state.graphics);
  state.onRender = (renderer) => {
    state.previousOnRender?.call(text, renderer);
    drawUnderline(text, state);
  };
  text.onRender = state.onRender;
  drawUnderline(text, state);
};

export const copyTextDecoration = (target, source) => {
  applyTextDecoration(target, {
    textDecoration: source[TEXT_UNDERLINE] ? "underline" : "none",
  });
};
