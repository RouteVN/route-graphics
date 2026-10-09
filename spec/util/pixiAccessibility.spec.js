import { afterEach, describe, expect, it } from "vitest";
import { AccessibilitySystem } from "pixi.js";
import { PIXI_ACCESSIBILITY_OPTIONS } from "../../src/util/pixiAccessibility.js";

const TAB_KEY_CODE = 9;

// Uses Pixi's real AccessibilitySystem with a stand-in renderer. The system
// registers its Tab listener on the window and its mouse listener on the
// document, and re-binds both handlers each time it activates, so a handler can
// outlive destroy().
const createRenderer = () => {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  return {
    canvas,
    renderer: {
      view: { canvas },
      runners: { postrender: { add() {}, remove() {} } },
      lastObjectRendered: undefined,
      renderingToScreen: true,
      screen: { x: 0, y: 0, width: 100, height: 100 },
    },
  };
};

const pressTab = () => {
  const event = new Event("keydown", { bubbles: true, cancelable: true });
  event.keyCode = TAB_KEY_CODE;
  globalThis.dispatchEvent(event);
};

const moveMouse = () => {
  const event = new window.Event("mousemove", {
    bubbles: true,
    cancelable: true,
  });
  event.movementX = 1;
  event.movementY = 1;
  document.dispatchEvent(event);
};

describe("Pixi accessibility options", () => {
  const errors = [];
  const record = (event) => {
    errors.push(event.error?.message ?? event.message);
    event.preventDefault();
  };

  afterEach(() => {
    globalThis.removeEventListener("error", record);
    window.removeEventListener("error", record);
    errors.length = 0;
    document.body.innerHTML = "";
  });

  it("leaves nothing listening after the application is destroyed", () => {
    globalThis.addEventListener("error", record);
    window.addEventListener("error", record);
    const { renderer, canvas } = createRenderer();
    const system = new AccessibilitySystem(renderer, {
      tablet: false,
      phone: false,
    });
    system.init({ accessibilityOptions: PIXI_ACCESSIBILITY_OPTIONS });

    pressTab();
    moveMouse();
    expect(system.isActive).toBe(false);

    system.destroy();
    pressTab();
    moveMouse();

    expect(errors).toEqual([]);
    expect(canvas.parentNode.querySelectorAll("div")).toHaveLength(0);
  });
});
