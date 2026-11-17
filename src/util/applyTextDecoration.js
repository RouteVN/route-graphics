import { CanvasTextMetrics, Graphics } from "pixi.js";

const TEXT_UNDERLINE = Symbol("textUnderline");
const underlineGeometry = new WeakMap();

export const hasTextUnderline = (text) => Boolean(text[TEXT_UNDERLINE]);

const hasUnderline = (decoration) =>
  typeof decoration === "string" &&
  decoration.split(/\s+/).includes("underline");

const getUnderlineRectangles = (text, line = null) => {
  if (!text.text) return [];
  const style = text.style;
  const cached = underlineGeometry.get(text);
  if (
    cached?.text === text.text &&
    cached.styleKey === style.styleKey &&
    cached.line === line
  ) {
    return cached.rectangles;
  }

  const metrics = CanvasTextMetrics.measureText(text.text, style);
  const strokeWidth = style._stroke?.width ?? 0;
  const lineThickness = Math.max(1, style.fontSize / 16);
  const lineShift = Math.max(
    0,
    (metrics.lineHeight - metrics.fontProperties.fontSize) / 2,
  );

  const rectangles = metrics.lineWidths.flatMap((lineWidth, index) => {
    if (lineWidth <= 0) return [];

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

    return [
      {
        line: index,
        x,
        // A caller-supplied line replaces the underline's vertical placement
        // (vertical text draws its sideline above a sideways run).
        y: line ? line.y + index * metrics.lineHeight : y,
        width: Math.min(lineWidth, metrics.width - x),
        height: line ? line.height : lineThickness,
      },
    ];
  });
  underlineGeometry.set(text, {
    text: text.text,
    styleKey: style.styleKey,
    line,
    rectangles,
  });
  return rectangles;
};

const drawUnderline = (text, state) => {
  const styleKey = text.style.styleKey;
  if (
    state.text === text.text &&
    state.styleKey === styleKey &&
    state.drawnRectangles === state.rectangles
  )
    return;

  state.text = text.text;
  state.styleKey = styleKey;
  state.drawnRectangles = state.rectangles;
  state.graphics.clear();
  const rectangles = text.text
    ? (state.rectangles ?? getUnderlineRectangles(text, state.line))
    : [];
  for (const rect of rectangles) {
    state.graphics
      .rect(rect.x, rect.y, rect.width, rect.height)
      .fill(text.style.fill);
  }
};

export const applyTextDecoration = (
  text,
  style,
  rectangles = null,
  line = null,
) => {
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
    if (JSON.stringify(existing.rectangles) !== JSON.stringify(rectangles))
      existing.rectangles = rectangles;
    if (JSON.stringify(existing.line) !== JSON.stringify(line)) {
      existing.line = line;
      existing.styleKey = null;
    }
    drawUnderline(text, existing);
    return;
  }

  const state = {
    graphics: new Graphics(),
    previousAllowChildren: text.allowChildren,
    previousOnRender: text.onRender,
    text: null,
    styleKey: null,
    rectangles,
    line,
    drawnRectangles: undefined,
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

// Partition the source line's decoration instead of measuring each unit again.
// Spaces and letter spacing have visible underline pixels, even when they do
// not create an authored animation target. Regions stay in the unit's original
// local coordinates so its alpha, movement and scale transform its own span.
export const copyTextDecoration = (target, source, regions) => {
  let rectangles = null;
  if (source[TEXT_UNDERLINE] && regions) {
    const sourceRectangles = getUnderlineRectangles(source);
    rectangles = regions.flatMap((region) =>
      sourceRectangles.flatMap((rect) => {
        if (rect.line !== region.line) return [];
        const left = Math.max(rect.x, region.start);
        const right = Math.min(rect.x + rect.width, region.end);
        return right > left
          ? [
              {
                x: left - region.x,
                y: rect.y - region.y,
                width: right - left,
                height: rect.height,
              },
            ]
          : [];
      }),
    );
  }
  applyTextDecoration(
    target,
    {
      textDecoration: source[TEXT_UNDERLINE] ? "underline" : "none",
    },
    rectangles,
  );
};
