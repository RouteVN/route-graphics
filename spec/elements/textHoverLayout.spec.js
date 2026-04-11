import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import { addText } from "../../src/plugins/elements/text/addText.js";
import { parseText } from "../../src/plugins/elements/text/parseText.js";

const createSharedParams = () => ({
  app: {
    audioStage: {
      add: vi.fn(),
    },
  },
  animations: [],
  animationBus: {
    dispatch: vi.fn(),
  },
  completionTracker: {
    getVersion: () => 0,
    track: () => {},
    complete: () => {},
  },
});

const getHorizontalOffset = (layoutWidth, measuredWidth, align) => {
  const remainingWidth = Math.max(0, layoutWidth - measuredWidth);

  if (align === "center") {
    return remainingWidth / 2;
  }

  if (align === "right") {
    return remainingWidth;
  }

  return 0;
};

describe("text hover layout", () => {
  it("keeps the text anchor stable when hover styles change text metrics", () => {
    const parent = new Container();
    const shared = createSharedParams();
    const element = parseText({
      state: {
        id: "text-hover-layout",
        type: "text",
        x: 240,
        y: 120,
        anchorX: 0.5,
        anchorY: 0.5,
        alpha: 1,
        content: "Hover layout",
        textStyle: {
          fontSize: 24,
          fontFamily: "Arial",
          fill: "#FFFFFF",
        },
        hover: {
          textStyle: {
            fontSize: 36,
            fontFamily: "Arial",
            fill: "#FFFFFF",
          },
        },
      },
    });

    addText({
      ...shared,
      parent,
      zIndex: 0,
      element,
    });

    const text = parent.getChildByLabel("text-hover-layout");
    const beforeHoverAnchorX = text.x + text.width * 0.5;
    const beforeHoverAnchorY = text.y + text.height * 0.5;

    text.emit("pointerover");

    expect(text.x + text.width * 0.5).toBeCloseTo(beforeHoverAnchorX, 4);
    expect(text.y + text.height * 0.5).toBeCloseTo(beforeHoverAnchorY, 4);

    text.emit("pointerout");

    expect(text.x + text.width * 0.5).toBeCloseTo(beforeHoverAnchorX, 4);
    expect(text.y + text.height * 0.5).toBeCloseTo(beforeHoverAnchorY, 4);
  });

  it("keeps hover and click textStyle states working together", () => {
    const parent = new Container();
    const shared = createSharedParams();
    const element = parseText({
      state: {
        id: "text-hover-click-styles",
        type: "text",
        x: 240,
        y: 120,
        anchorX: 0.5,
        anchorY: 0.5,
        alpha: 1,
        content: "Hover then click",
        textStyle: {
          fontSize: 24,
          fontFamily: "Arial",
          fill: "#A6A6A6",
        },
        hover: {
          textStyle: {
            fill: "#FFFFFF",
          },
        },
        click: {
          textStyle: {
            fill: "#D9D9D9",
            fontSize: 48,
          },
        },
      },
    });

    addText({
      ...shared,
      parent,
      zIndex: 0,
      element,
    });

    const text = parent.getChildByLabel("text-hover-click-styles");

    text.emit("pointerover");
    expect(text.style.fill).toBe("#FFFFFF");
    expect(text.style.fontSize).toBe(24);
    expect(text.style.fontFamily).toBe("Arial");

    text.emit("pointerdown");
    expect(text.style.fill).toBe("#D9D9D9");
    expect(text.style.fontSize).toBe(48);
    expect(text.style.fontFamily).toBe("Arial");
    expect(text.style.lineHeight).toBe(58);

    text.emit("pointerup");
    expect(text.style.fill).toBe("#FFFFFF");
    expect(text.style.fontSize).toBe(24);

    text.emit("pointerout");
    expect(text.style.fill).toBe("#A6A6A6");
    expect(text.style.fontSize).toBe(24);
  });

  it("maps strokeColor and strokeWidth to Pixi stroke options", () => {
    const parent = new Container();
    const shared = createSharedParams();
    const element = parseText({
      state: {
        id: "text-stroke-style",
        type: "text",
        x: 20,
        y: 30,
        alpha: 1,
        content: "Outlined",
        textStyle: {
          fontSize: 24,
          fontFamily: "Arial",
          fill: "#FFFFFF",
          strokeColor: "#112233",
          strokeWidth: 4,
        },
      },
    });

    addText({
      ...shared,
      parent,
      zIndex: 0,
      element,
    });

    const text = parent.getChildByLabel("text-stroke-style");

    expect(text.style.stroke).toMatchObject({
      color: "#112233",
      width: 4,
    });
  });

  it("positions centered fixed-width text inside the layout box", () => {
    const parent = new Container();
    const shared = createSharedParams();
    const element = parseText({
      state: {
        id: "text-fixed-center",
        type: "text",
        x: 40,
        y: 60,
        width: 200,
        content: "Centered",
        textStyle: {
          fontSize: 24,
          fontFamily: "Arial",
          fill: "#FFFFFF",
          align: "center",
        },
      },
    });

    addText({
      ...shared,
      parent,
      zIndex: 0,
      element,
    });

    const text = parent.getChildByLabel("text-fixed-center");
    expect(text.x).toBeCloseTo(element.x + (element.width - text.width) / 2, 4);
    expect(text.y).toBe(element.y);
  });

  it("positions right-aligned fixed-width text inside the layout box", () => {
    const parent = new Container();
    const shared = createSharedParams();
    const element = parseText({
      state: {
        id: "text-fixed-right",
        type: "text",
        x: 40,
        y: 60,
        width: 200,
        content: "Right",
        textStyle: {
          fontSize: 24,
          fontFamily: "Arial",
          fill: "#FFFFFF",
          align: "right",
        },
      },
    });

    addText({
      ...shared,
      parent,
      zIndex: 0,
      element,
    });

    const text = parent.getChildByLabel("text-fixed-right");
    expect(text.x).toBeCloseTo(element.x + element.width - text.width, 4);
    expect(text.y).toBe(element.y);
  });

  it("keeps a fixed-width box anchor stable when hover styles change text metrics", () => {
    const parent = new Container();
    const shared = createSharedParams();
    const element = parseText({
      state: {
        id: "text-fixed-width-hover-layout",
        type: "text",
        x: 240,
        y: 120,
        width: 200,
        anchorX: 0.5,
        anchorY: 0.5,
        alpha: 1,
        content: "Hover layout",
        textStyle: {
          fontSize: 24,
          fontFamily: "Arial",
          fill: "#FFFFFF",
          align: "center",
        },
        hover: {
          textStyle: {
            fontSize: 36,
            fontFamily: "Arial",
            fill: "#FFFFFF",
            align: "center",
          },
        },
      },
    });

    addText({
      ...shared,
      parent,
      zIndex: 0,
      element,
    });

    const text = parent.getChildByLabel("text-fixed-width-hover-layout");
    const getBoxCenter = () => {
      const offset = getHorizontalOffset(element.width, text.width, text.style.align);
      return {
        x: text.x - offset + element.width * 0.5,
        y: text.y + text.height * 0.5,
      };
    };

    const beforeHoverAnchor = getBoxCenter();

    text.emit("pointerover");

    expect(getBoxCenter().x).toBeCloseTo(beforeHoverAnchor.x, 4);
    expect(getBoxCenter().y).toBeCloseTo(beforeHoverAnchor.y, 4);

    text.emit("pointerout");

    expect(getBoxCenter().x).toBeCloseTo(beforeHoverAnchor.x, 4);
    expect(getBoxCenter().y).toBeCloseTo(beforeHoverAnchor.y, 4);
  });
});
