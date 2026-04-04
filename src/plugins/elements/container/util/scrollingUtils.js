import { Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";

const DEFAULT_SCROLLBAR_BUTTON_STEP = 24;
const DEFAULT_MIN_THUMB_SIZE = 24;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clamp01 = (value) => clamp(value, 0, 1);

const stopPropagation = (event) => {
  event?.stopPropagation?.();
};

const getScrollbarTexture = (src) => (src ? Texture.from(src) : Texture.EMPTY);

const createScrollSprite = ({ label }) => {
  const sprite = new Sprite(Texture.EMPTY);
  sprite.label = label;
  sprite.eventMode = "static";
  sprite.cursor = "pointer";
  return sprite;
};

const resolvePartSource = ({ config, state }) => {
  if (!config) return "";
  if (state?.pressed && config.pressSrc) return config.pressSrc;
  if (state?.hovered && config.hoverSrc) return config.hoverSrc;
  return config.src ?? "";
};

const setSpriteVisualState = ({ sprite, config, state, width, height }) => {
  if (!sprite) return;

  sprite.texture = getScrollbarTexture(
    resolvePartSource({
      config,
      state,
    }),
  );
  sprite.width = Math.max(width, 0);
  sprite.height = Math.max(height, 0);
  sprite.visible = sprite.width > 0 && sprite.height > 0;
  sprite.eventMode = sprite.visible ? "static" : "none";
};

const getVerticalScrollbarLabels = (id) => ({
  root: `${id}-scrollbar-vertical`,
  track: `${id}-scrollbar-vertical-track`,
  thumb: `${id}-scrollbar-vertical-thumb`,
  startButton: `${id}-scrollbar-vertical-start-button`,
  endButton: `${id}-scrollbar-vertical-end-button`,
});

const isAtEdge = (value, edge) => Math.abs(value - edge) < 0.5;

const getInitialAxisOffset = ({
  hasOverflow,
  minScroll,
  previousOffset,
  wasAtEnd,
  anchorToEnd,
}) => {
  if (!hasOverflow) {
    return 0;
  }

  if (anchorToEnd && (previousOffset === undefined || wasAtEnd)) {
    return minScroll;
  }

  if (typeof previousOffset === "number") {
    return clamp(previousOffset, minScroll, 0);
  }

  return 0;
};

const createVerticalScrollbar = ({ controller }) => {
  const labels = getVerticalScrollbarLabels(controller.container.label);
  const config = controller.element.scrollbar?.vertical;

  if (!config) {
    return null;
  }

  const root = new Container({
    label: labels.root,
  });
  root.eventMode = "static";
  root.cursor = "pointer";

  const track = createScrollSprite({
    label: labels.track,
  });
  const thumb = createScrollSprite({
    label: labels.thumb,
  });

  const verticalScrollbar = {
    config,
    root,
    track,
    thumb,
    startButton: null,
    endButton: null,
    states: {
      track: {
        hovered: false,
        pressed: false,
      },
      thumb: {
        hovered: false,
        pressed: false,
        dragging: false,
      },
      startButton: {
        hovered: false,
        pressed: false,
      },
      endButton: {
        hovered: false,
        pressed: false,
      },
    },
    dragOffsetY: 0,
  };

  root.addChild(track);
  root.addChild(thumb);

  if (config.startButton) {
    verticalScrollbar.startButton = createScrollSprite({
      label: labels.startButton,
    });
    root.addChild(verticalScrollbar.startButton);
  }

  if (config.endButton) {
    verticalScrollbar.endButton = createScrollSprite({
      label: labels.endButton,
    });
    root.addChild(verticalScrollbar.endButton);
  }

  const syncVisuals = () => {
    syncVerticalScrollbar({
      controller,
    });
  };

  track.on("pointerover", () => {
    verticalScrollbar.states.track.hovered = true;
    syncVisuals();
  });
  track.on("pointerout", () => {
    verticalScrollbar.states.track.hovered = false;
    syncVisuals();
  });
  track.on("pointerdown", (event) => {
    stopPropagation(event);
    verticalScrollbar.states.track.pressed = true;
    syncVisuals();

    const localPoint = root.toLocal(event.global);
    const { thumb } = verticalScrollbar;
    const viewportStep = controller.viewportHeight;

    if (localPoint.y < thumb.y) {
      controller.setScrollOffsets({
        y: controller.scrollYOffset + viewportStep,
        source: "track",
      });
    } else if (localPoint.y > thumb.y + thumb.height) {
      controller.setScrollOffsets({
        y: controller.scrollYOffset - viewportStep,
        source: "track",
      });
    }
  });

  const releaseTrack = (event) => {
    stopPropagation(event);
    verticalScrollbar.states.track.pressed = false;
    syncVisuals();
  };

  track.on("pointerup", releaseTrack);
  track.on("pointerupoutside", releaseTrack);

  thumb.on("pointerover", () => {
    verticalScrollbar.states.thumb.hovered = true;
    syncVisuals();
  });
  thumb.on("pointerout", () => {
    verticalScrollbar.states.thumb.hovered = false;
    if (!verticalScrollbar.states.thumb.dragging) {
      syncVisuals();
    }
  });
  thumb.on("pointerdown", (event) => {
    stopPropagation(event);
    const localPoint = root.toLocal(event.global);
    verticalScrollbar.states.thumb.pressed = true;
    verticalScrollbar.states.thumb.dragging = true;
    verticalScrollbar.dragOffsetY = localPoint.y - verticalScrollbar.thumb.y;
    syncVisuals();
  });

  const releaseThumb = (event) => {
    stopPropagation(event);
    if (!verticalScrollbar.states.thumb.dragging) {
      verticalScrollbar.states.thumb.pressed = false;
      syncVisuals();
      return;
    }

    verticalScrollbar.states.thumb.dragging = false;
    verticalScrollbar.states.thumb.pressed = false;
    syncVisuals();
  };

  root.on("globalpointermove", (event) => {
    if (!verticalScrollbar.states.thumb.dragging) {
      return;
    }

    const localPoint = root.toLocal(event.global);
    const trackStartY = verticalScrollbar.track.y;
    const trackTravel = Math.max(
      verticalScrollbar.track.height - verticalScrollbar.thumb.height,
      0,
    );

    if (trackTravel <= 0 || controller.minScrollY === 0) {
      controller.setScrollOffsets({
        y: 0,
        source: "thumb",
      });
      return;
    }

    const nextThumbY = clamp(
      localPoint.y - verticalScrollbar.dragOffsetY,
      trackStartY,
      trackStartY + trackTravel,
    );
    const progress = clamp01((nextThumbY - trackStartY) / trackTravel);

    controller.setScrollOffsets({
      y: controller.minScrollY * progress,
      source: "thumb",
    });
  });
  thumb.on("pointerup", releaseThumb);
  thumb.on("pointerupoutside", releaseThumb);
  root.on("pointerup", releaseThumb);
  root.on("pointerupoutside", releaseThumb);

  const bindButton = ({
    sprite,
    config: buttonConfig,
    state,
    deltaDirection,
  }) => {
    if (!sprite || !buttonConfig) {
      return;
    }

    sprite.on("pointerover", () => {
      state.hovered = true;
      syncVisuals();
    });
    sprite.on("pointerout", () => {
      state.hovered = false;
      syncVisuals();
    });
    sprite.on("pointerdown", (event) => {
      stopPropagation(event);
      state.pressed = true;
      syncVisuals();

      controller.setScrollOffsets({
        y:
          controller.scrollYOffset +
          deltaDirection *
            Math.max(buttonConfig.step ?? DEFAULT_SCROLLBAR_BUTTON_STEP, 0),
        source: "button",
      });
    });

    const release = (event) => {
      stopPropagation(event);
      state.pressed = false;
      syncVisuals();
    };

    sprite.on("pointerup", release);
    sprite.on("pointerupoutside", release);
  };

  bindButton({
    sprite: verticalScrollbar.startButton,
    config: config.startButton,
    state: verticalScrollbar.states.startButton,
    deltaDirection: 1,
  });
  bindButton({
    sprite: verticalScrollbar.endButton,
    config: config.endButton,
    state: verticalScrollbar.states.endButton,
    deltaDirection: -1,
  });

  controller.container.addChild(root);

  return verticalScrollbar;
};

const syncVerticalScrollbar = ({ controller }) => {
  const verticalScrollbar = controller.verticalScrollbar;

  if (!verticalScrollbar) {
    return;
  }

  const { config, root, track, thumb, startButton, endButton, states } =
    verticalScrollbar;
  const thickness = Math.max(config.thickness ?? 0, 0);
  const startButtonSize = startButton
    ? Math.max(config.startButton?.size ?? thickness, 0)
    : 0;
  const endButtonSize = endButton
    ? Math.max(config.endButton?.size ?? thickness, 0)
    : 0;
  const trackHeight = Math.max(
    controller.viewportHeight - startButtonSize - endButtonSize,
    0,
  );
  const minThumbSize = Math.min(DEFAULT_MIN_THUMB_SIZE, trackHeight);
  const fixedThumbHeight = config.thumb?.length;
  const rawThumbHeight =
    typeof fixedThumbHeight === "number"
      ? fixedThumbHeight
      : controller.totalHeight > 0
        ? Math.round(
            (controller.viewportHeight / controller.totalHeight) * trackHeight,
          )
        : trackHeight;
  const thumbHeight =
    trackHeight > 0
      ? typeof fixedThumbHeight === "number"
        ? clamp(rawThumbHeight, 0, trackHeight)
        : clamp(rawThumbHeight, minThumbSize, trackHeight)
      : 0;
  const thumbTravel = Math.max(trackHeight - thumbHeight, 0);
  const progress =
    controller.minScrollY === 0
      ? 0
      : clamp01(controller.scrollYOffset / controller.minScrollY);

  root.visible =
    controller.hasVerticalOverflow &&
    controller.element.scroll &&
    thickness > 0 &&
    controller.viewportHeight > 0;
  root.x = Math.max(controller.viewportWidth - thickness, 0);
  root.y = 0;

  track.x = 0;
  track.y = startButtonSize;
  setSpriteVisualState({
    sprite: track,
    config: config.track,
    state: states.track,
    width: thickness,
    height: trackHeight,
  });

  thumb.x = 0;
  thumb.y = startButtonSize + thumbTravel * progress;
  setSpriteVisualState({
    sprite: thumb,
    config: config.thumb,
    state: states.thumb,
    width: thickness,
    height: thumbHeight,
  });

  if (startButton) {
    startButton.x = 0;
    startButton.y = 0;
    setSpriteVisualState({
      sprite: startButton,
      config: config.startButton,
      state: states.startButton,
      width: thickness,
      height: startButtonSize,
    });
  }

  if (endButton) {
    endButton.x = 0;
    endButton.y = controller.viewportHeight - endButtonSize;
    setSpriteVisualState({
      sprite: endButton,
      config: config.endButton,
      state: states.endButton,
      width: thickness,
      height: endButtonSize,
    });
  }
};

export const getScrollingState = ({ container }) => {
  const controller = container.__routeGraphicsScrollController;

  if (!controller) {
    return null;
  }

  return {
    scrollXOffset: controller.scrollXOffset,
    scrollYOffset: controller.scrollYOffset,
    wasAtHorizontalEnd:
      controller.hasHorizontalOverflow &&
      isAtEdge(controller.scrollXOffset, controller.minScrollX),
    wasAtVerticalEnd:
      controller.hasVerticalOverflow &&
      isAtEdge(controller.scrollYOffset, controller.minScrollY),
  };
};

/**
 * @param {import("../../../../types").SetupScrollingOptions} params
 * @returns
 */
export const setupScrolling = ({
  container,
  element,
  interactive = true,
  allowViewportWithoutScroll = false,
  previousState = null,
}) => {
  let totalWidth = 0;
  let totalHeight = 0;

  element.children.forEach((child) => {
    totalWidth = Math.max(child.width + child.x, totalWidth);
    totalHeight = Math.max(child.height + child.y, totalHeight);
  });

  const hasVerticalOverflow = !!(
    element.height && totalHeight > element.height
  );
  const hasHorizontalOverflow = !!(element.width && totalWidth > element.width);
  const shouldEnableViewport =
    (element.scroll || allowViewportWithoutScroll) &&
    (hasVerticalOverflow || hasHorizontalOverflow);

  if (shouldEnableViewport) {
    // Create a content container that will hold all the children
    const contentContainer = new Container({
      label: `${container.label}-content`,
    });

    // Move all children from the main container to the content container
    const children = [...container.children];
    children.forEach((child) => {
      contentContainer.addChild(child);
    });

    // Add the content container back to the main container
    container.addChild(contentContainer);

    // Create clipping mask
    const clip = new Graphics({ label: `${container.label}-clip` })
      .rect(0, 0, element.width || totalWidth, element.height || totalHeight)
      .fill({ color: 0xff0000, alpha: 0 });
    container.addChild(clip);

    // Apply the mask to the content container
    contentContainer.mask = clip;

    const minScrollY = -(totalHeight - (element.height || totalHeight));
    const minScrollX = -(totalWidth - (element.width || totalWidth));
    const controller = {
      container,
      contentContainer,
      clip,
      element,
      totalWidth,
      totalHeight,
      viewportWidth: element.width || totalWidth,
      viewportHeight: element.height || totalHeight,
      hasHorizontalOverflow,
      hasVerticalOverflow,
      minScrollX,
      minScrollY,
      scrollXOffset: getInitialAxisOffset({
        hasOverflow: hasHorizontalOverflow,
        minScroll: minScrollX,
        previousOffset: previousState?.scrollXOffset,
        wasAtEnd: previousState?.wasAtHorizontalEnd,
        anchorToEnd: !!element.anchorToBottom,
      }),
      scrollYOffset: getInitialAxisOffset({
        hasOverflow: hasVerticalOverflow,
        minScroll: minScrollY,
        previousOffset: previousState?.scrollYOffset,
        wasAtEnd: previousState?.wasAtVerticalEnd,
        anchorToEnd: !!element.anchorToBottom,
      }),
      verticalScrollbar: null,
      setScrollOffsets: ({ x, y }) => {
        const nextX = x ?? controller.scrollXOffset;
        const nextY = y ?? controller.scrollYOffset;

        controller.scrollXOffset = controller.hasHorizontalOverflow
          ? clamp(nextX, controller.minScrollX, 0)
          : 0;
        controller.scrollYOffset = controller.hasVerticalOverflow
          ? clamp(nextY, controller.minScrollY, 0)
          : 0;

        controller.contentContainer.x = controller.scrollXOffset;
        controller.contentContainer.y = controller.scrollYOffset;

        syncVerticalScrollbar({
          controller,
        });
      },
    };

    container.__routeGraphicsScrollController = controller;
    controller.verticalScrollbar = createVerticalScrollbar({
      controller,
    });
    controller.setScrollOffsets({
      x: controller.scrollXOffset,
      y: controller.scrollYOffset,
      source: "initial",
    });

    if (interactive) {
      // Capture wheel input in the viewport area when interactive scrolling is enabled.
      container.eventMode = "static";
      container.hitArea = new Rectangle(
        0,
        0,
        element.width || totalWidth,
        element.height || totalHeight,
      );

      container.on("wheel", (e) => {
        e.preventDefault(); // Prevent page scrolling

        // Handle vertical scrolling
        if (hasVerticalOverflow && e.deltaY !== 0) {
          controller.setScrollOffsets({
            y: controller.scrollYOffset - e.deltaY,
            source: "wheel",
          });
        }

        // Handle horizontal scrolling (shift+wheel or deltaX)
        if (
          hasHorizontalOverflow &&
          (e.deltaX !== 0 || (e.shiftKey && e.deltaY !== 0))
        ) {
          const deltaX = e.deltaX !== 0 ? e.deltaX : e.deltaY;
          controller.setScrollOffsets({
            x: controller.scrollXOffset - deltaX,
            source: "wheel",
          });
        }
      });
    }
  }
};

/**
 * Remove scrolling setup from a container
 * @param {import("../../../../types").RemoveScrollingOptions} params
 */
export const removeScrolling = ({ container }) => {
  const controller = container.__routeGraphicsScrollController;
  const contentContainer = container.children.find(
    (child) => child.label && child.label.endsWith("-content"),
  );
  const clip = container.children.find(
    (child) => child.label && child.label.endsWith("-clip"),
  );
  const verticalScrollbarRoot = container.children.find(
    (child) => child.label && child.label.endsWith("-scrollbar-vertical"),
  );

  if (contentContainer) {
    const children = [...contentContainer.children];
    children.forEach((child) => {
      child.mask = null;
      container.addChild(child);
    });

    container.removeChild(contentContainer);
    contentContainer.destroy({
      children: false,
    });
  }

  if (clip) {
    container.removeChild(clip);
    clip.destroy();
  }

  if (verticalScrollbarRoot) {
    container.removeChild(verticalScrollbarRoot);
    verticalScrollbarRoot.destroy({
      children: true,
    });
  }

  container.eventMode = "auto";
  container.hitArea = null;
  container.removeAllListeners("wheel");
  if (controller) {
    container.__routeGraphicsScrollController = undefined;
  }
};
