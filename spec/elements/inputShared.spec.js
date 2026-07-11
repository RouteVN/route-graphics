import { Container, FillGradient } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import { parseInput } from "../../src/plugins/elements/input/parseInput.js";
import {
  buildInputRuntime,
  createInputDisplay,
  getInputIndexFromLocalPoint,
  syncInputView,
} from "../../src/plugins/elements/input/inputShared.js";

const createRuntime = (state, { sync = true } = {}) => {
  const element = parseInput({
    state: {
      id: "input-test",
      type: "input",
      x: 0,
      y: 0,
      width: 240,
      height: 80,
      ...state,
    },
  });
  const container = new Container();
  const display = createInputDisplay(element);
  const runtime = buildInputRuntime({
    app: {},
    container,
    display,
    element,
  });

  if (sync) {
    syncInputView(runtime, element);
  }

  return { element, runtime };
};

const createRuntimeWithMockedBackground = (state) => {
  const result = createRuntime(state, { sync: false });

  result.runtime.background.clear = vi.fn();
  result.runtime.background.rect = vi.fn();
  result.runtime.background.fill = vi.fn();
  result.runtime.background.stroke = vi.fn();

  return result;
};

describe("inputShared hit testing", () => {
  it("maps single-line local points to caret indices", () => {
    const { runtime } = createRuntime({
      height: 48,
      value: "Hello",
    });

    expect(
      getInputIndexFromLocalPoint(runtime, {
        x: runtime.text.x + 1,
        y: runtime.text.y + runtime.text.height / 2,
      }),
    ).toBe(0);

    expect(
      getInputIndexFromLocalPoint(runtime, {
        x: runtime.text.x + runtime.text.width + 20,
        y: runtime.text.y + runtime.text.height / 2,
      }),
    ).toBe(5);
  });

  it("maps multiline local points to the correct line index", () => {
    const { runtime } = createRuntime({
      multiline: true,
      value: "Hello\nWorld",
      textStyle: {
        fontSize: 20,
        lineHeight: 28,
      },
    });

    const lineHeight = runtime.layoutState.layout.lineHeight;
    const secondLineIndex = getInputIndexFromLocalPoint(runtime, {
      x: runtime.text.x + 1,
      y: runtime.text.y + lineHeight + 2,
    });

    expect(secondLineIndex).toBeGreaterThanOrEqual(6);
  });

  it("honors multiline text alignment for rendering and hit testing", () => {
    const { runtime } = createRuntime({
      multiline: true,
      value: "Hi\nWorld",
      textStyle: {
        align: "center",
        fontSize: 20,
        lineHeight: 28,
      },
    });

    const [firstLineNode, secondLineNode] = runtime.text.children;
    const secondLineStartIndex = runtime.layoutState.layout.lines[1].startIndex;
    const actualSecondLineStartX = runtime.text.x + secondLineNode.x;
    const actualSecondLineY = runtime.text.y + secondLineNode.y;

    expect(firstLineNode.x).toBeGreaterThan(0);
    expect(secondLineNode.x).toBeGreaterThan(0);
    expect(
      getInputIndexFromLocalPoint(runtime, {
        x: actualSecondLineStartX + 1,
        y: actualSecondLineY + runtime.layoutState.layout.lineHeight / 2,
      }),
    ).toBe(secondLineStartIndex);
  });
});

describe("inputShared chrome rendering", () => {
  it("draws the default fill and border chrome", () => {
    const { element, runtime } = createRuntimeWithMockedBackground({});

    syncInputView(runtime, element);

    expect(runtime.background.rect).toHaveBeenCalledWith(0, 0, 240, 80);
    expect(runtime.background.fill).toHaveBeenCalledWith("#FFFFFF");
    expect(runtime.background.stroke).toHaveBeenCalledTimes(1);
    expect(runtime.background.stroke).toHaveBeenCalledWith({
      color: "#2E2E2E",
      alpha: 1,
      width: 1,
    });
  });

  it("draws custom border and focus ring chrome when focused", () => {
    const { element, runtime } = createRuntimeWithMockedBackground({
      fill: "#101820",
      border: {
        width: 2,
        color: "#334155",
        alpha: 0.75,
      },
      focusRing: {
        width: 3,
        color: "#38BDF8",
        alpha: 0.9,
      },
    });

    runtime.focused = true;
    syncInputView(runtime, element);

    expect(runtime.background.fill).toHaveBeenCalledWith("#101820");
    expect(runtime.background.stroke).toHaveBeenCalledTimes(2);
    expect(runtime.background.stroke).toHaveBeenNthCalledWith(1, {
      color: "#334155",
      alpha: 0.75,
      width: 2,
    });
    expect(runtime.background.stroke).toHaveBeenNthCalledWith(2, {
      color: "#38BDF8",
      alpha: 0.9,
      width: 3,
    });
  });

  it("does not draw focus ring chrome for disabled inputs", () => {
    const { element, runtime } = createRuntimeWithMockedBackground({
      disabled: true,
      focusRing: {
        width: 4,
        color: "#FF0000",
      },
    });

    runtime.focused = true;
    syncInputView(runtime, element);

    expect(runtime.background.stroke).toHaveBeenCalledTimes(1);
    expect(runtime.background.stroke).toHaveBeenCalledWith({
      color: "#2E2E2E",
      alpha: 1,
      width: 1,
    });
  });

  it("supports transparent fills and disabled strokes", () => {
    const { element, runtime } = createRuntimeWithMockedBackground({
      fill: "transparent",
      border: {
        width: 0,
      },
      focusRing: {
        width: 0,
      },
    });

    runtime.focused = true;
    syncInputView(runtime, element);

    expect(runtime.background.fill).toHaveBeenCalledWith({
      color: 0x000000,
      alpha: 0,
    });
    expect(runtime.background.stroke).not.toHaveBeenCalled();
  });

  it("supports rect-compatible gradient fills", () => {
    const { element, runtime } = createRuntimeWithMockedBackground({
      fill: {
        type: "linear-gradient",
        start: { x: 0, y: 0 },
        end: { x: 1, y: 0 },
        stops: [
          { offset: 0, color: "#101820" },
          { offset: 1, color: "#38BDF8" },
        ],
      },
    });

    syncInputView(runtime, element);

    const fill = runtime.background.fill.mock.calls[0][0];

    expect(fill).toBeInstanceOf(FillGradient);
    expect(runtime.background._rtglFillResource).toBe(fill);
  });
});
