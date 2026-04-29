import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import { addText } from "../../src/plugins/elements/text/addText.js";
import { parseText } from "../../src/plugins/elements/text/parseText.js";
import { getTextLayoutPosition } from "../../src/plugins/elements/text/textLayout.js";

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

  it("maps shadow to Pixi dropShadow options", () => {
    const parent = new Container();
    const shared = createSharedParams();
    const element = parseText({
      state: {
        id: "text-shadow-style",
        type: "text",
        x: 20,
        y: 30,
        alpha: 1,
        content: "Shadowed",
        textStyle: {
          fontSize: 24,
          fontFamily: "Arial",
          fill: "#FFFFFF",
          shadow: {
            color: "#112233",
            alpha: 0.5,
            blur: 4,
            offsetX: 3,
            offsetY: 4,
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

    const text = parent.getChildByLabel("text-shadow-style");

    expect(text.style.dropShadow).toMatchObject({
      color: "#112233",
      alpha: 0.5,
      blur: 4,
      distance: 5,
    });
    expect(text.style.dropShadow.angle).toBeCloseTo(Math.atan2(4, 3), 8);
    expect(text.style.padding).toBe(9);
  });

  it("deep-merges and removes shadow in interactive textStyle states", () => {
    const parent = new Container();
    const shared = createSharedParams();
    const element = parseText({
      state: {
        id: "text-interactive-shadow",
        type: "text",
        x: 20,
        y: 30,
        alpha: 1,
        content: "Interactive shadow",
        textStyle: {
          fontSize: 24,
          fontFamily: "Arial",
          fill: "#A6A6A6",
          shadow: {
            color: "#111111",
            alpha: 0.35,
            blur: 3,
            offsetX: 2,
            offsetY: 5,
          },
        },
        hover: {
          textStyle: {
            fill: "#FFFFFF",
            shadow: {
              color: "#333333",
              alpha: 0.85,
            },
          },
        },
        click: {
          textStyle: {
            shadow: null,
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

    const text = parent.getChildByLabel("text-interactive-shadow");
    const baseDistance = Math.hypot(2, 5);
    const baseAngle = Math.atan2(5, 2);

    expect(text.style.dropShadow).toMatchObject({
      color: "#111111",
      alpha: 0.35,
      blur: 3,
      distance: baseDistance,
    });

    text.emit("pointerover");

    expect(text.style.fill).toBe("#FFFFFF");
    expect(text.style.dropShadow).toMatchObject({
      color: "#333333",
      alpha: 0.85,
      blur: 3,
      distance: baseDistance,
    });
    expect(text.style.dropShadow.angle).toBeCloseTo(baseAngle, 8);

    text.emit("pointerdown");

    expect(text.style.dropShadow).toBeNull();

    text.emit("pointerup");

    expect(text.style.dropShadow).toMatchObject({
      color: "#333333",
      alpha: 0.85,
      blur: 3,
      distance: baseDistance,
    });

    text.emit("pointerout");

    expect(text.style.dropShadow).toMatchObject({
      color: "#111111",
      alpha: 0.35,
      blur: 3,
      distance: baseDistance,
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

  it("positions centered fixed-width text with shadows by glyph width", () => {
    const parent = new Container();
    const shared = createSharedParams();
    const element = parseText({
      state: {
        id: "text-fixed-center-shadow",
        type: "text",
        x: 40,
        y: 60,
        width: 260,
        content: "Centered",
        textStyle: {
          fontSize: 24,
          fontFamily: "Arial",
          fill: "#FFFFFF",
          align: "center",
          shadow: {
            color: "#737373",
            blur: 0,
            offsetX: 12,
            offsetY: 0,
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

    const text = parent.getChildByLabel("text-fixed-center-shadow");
    const targetPosition = getTextLayoutPosition(element);

    expect(text.width).toBeGreaterThan(element.measuredWidth);
    expect(text.x).toBeCloseTo(targetPosition.x, 4);
    expect(text.x).toBeCloseTo(
      element.x + (element.width - element.measuredWidth) / 2,
      4,
    );
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

  it("positions right-aligned fixed-width text with shadows by glyph width", () => {
    const parent = new Container();
    const shared = createSharedParams();
    const element = parseText({
      state: {
        id: "text-fixed-right-shadow",
        type: "text",
        x: 40,
        y: 60,
        width: 260,
        content: "Right",
        textStyle: {
          fontSize: 24,
          fontFamily: "Arial",
          fill: "#FFFFFF",
          align: "right",
          shadow: {
            color: "#737373",
            blur: 0,
            offsetX: 12,
            offsetY: 0,
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

    const text = parent.getChildByLabel("text-fixed-right-shadow");
    const targetPosition = getTextLayoutPosition(element);

    expect(text.width).toBeGreaterThan(element.measuredWidth);
    expect(text.x).toBeCloseTo(targetPosition.x, 4);
    expect(text.x).toBeCloseTo(
      element.x + element.width - element.measuredWidth,
      4,
    );
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
      const offset = getHorizontalOffset(
        element.width,
        text.width,
        text.style.align,
      );
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

  it("keeps fixed-width aligned text stable when only shadow metrics change", () => {
    const parent = new Container();
    const shared = createSharedParams();
    const element = parseText({
      state: {
        id: "text-fixed-shadow-hover-layout",
        type: "text",
        x: 80,
        y: 120,
        width: 260,
        alpha: 1,
        content: "Shadow hover",
        textStyle: {
          fontSize: 24,
          fontFamily: "Arial",
          fill: "#FFFFFF",
          align: "center",
          shadow: {
            color: "#737373",
            blur: 0,
            offsetX: 4,
            offsetY: 0,
          },
        },
        hover: {
          textStyle: {
            shadow: {
              offsetX: 28,
            },
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

    const text = parent.getChildByLabel("text-fixed-shadow-hover-layout");
    const beforeHoverX = text.x;
    const beforeHoverWidth = text.width;

    text.emit("pointerover");

    expect(text.style.dropShadow.distance).toBe(28);
    expect(text.width).toBeGreaterThan(beforeHoverWidth);
    expect(text.x).toBeCloseTo(beforeHoverX, 4);

    text.emit("pointerout");

    expect(text.style.dropShadow.distance).toBe(4);
    expect(text.x).toBeCloseTo(beforeHoverX, 4);
  });
});
