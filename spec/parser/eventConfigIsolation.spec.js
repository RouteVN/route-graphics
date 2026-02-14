import { describe, expect, it } from "vitest";
import { parseRect } from "../../src/plugins/elements/rect/parseRect.js";
import { parseSlider } from "../../src/plugins/elements/slider/parseSlider.js";
import { parseContainer } from "../../src/plugins/elements/container/parseContainer.js";

describe("event config isolation", () => {
  it("parseRect clones event configs from input state", () => {
    const state = {
      id: "rect-1",
      type: "rect",
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      hover: { actionPayload: { nested: { value: 1 } } },
      click: { actionPayload: { nested: { value: 2 } } },
      rightClick: { actionPayload: { nested: { value: 3 } } },
      drag: { start: { actionPayload: { nested: { value: 4 } } } },
      scroll: { up: { actionPayload: { nested: { value: 5 } } } },
    };

    const parsed = parseRect({ state });

    state.hover.actionPayload.nested.value = 11;
    state.click.actionPayload.nested.value = 12;
    state.rightClick.actionPayload.nested.value = 13;
    state.drag.start.actionPayload.nested.value = 14;
    state.scroll.up.actionPayload.nested.value = 15;

    expect(parsed.hover.actionPayload.nested.value).toBe(1);
    expect(parsed.click.actionPayload.nested.value).toBe(2);
    expect(parsed.rightClick.actionPayload.nested.value).toBe(3);
    expect(parsed.drag.start.actionPayload.nested.value).toBe(4);
    expect(parsed.scroll.up.actionPayload.nested.value).toBe(5);
  });

  it("parseSlider clones hover/change configs from input state", () => {
    const state = {
      id: "slider-1",
      type: "slider",
      x: 0,
      y: 0,
      width: 200,
      height: 20,
      initialValue: 10,
      min: 0,
      max: 100,
      hover: { actionPayload: { nested: { value: 1 } } },
      change: { actionPayload: { nested: { value: 2 } } },
    };

    const parsed = parseSlider({ state });

    state.hover.actionPayload.nested.value = 7;
    state.change.actionPayload.nested.value = 8;

    expect(parsed.hover.actionPayload.nested.value).toBe(1);
    expect(parsed.change.actionPayload.nested.value).toBe(2);
  });

  it("parseContainer clones rightClick config from input state", () => {
    const state = {
      id: "container-1",
      type: "container",
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      children: [],
      rightClick: { actionPayload: { nested: { value: 9 } } },
    };

    const parsed = parseContainer({ state, parserPlugins: [] });

    state.rightClick.actionPayload.nested.value = 99;

    expect(parsed.rightClick.actionPayload.nested.value).toBe(9);
  });
});
