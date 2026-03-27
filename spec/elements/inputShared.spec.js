import { Container } from "pixi.js";
import { describe, expect, it } from "vitest";
import { parseInput } from "../../src/plugins/elements/input/parseInput.js";
import {
  buildInputRuntime,
  createInputDisplay,
  getInputIndexFromLocalPoint,
  syncInputView,
} from "../../src/plugins/elements/input/inputShared.js";

const createRuntime = (state) => {
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

  syncInputView(runtime, element);

  return { element, runtime };
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
});
