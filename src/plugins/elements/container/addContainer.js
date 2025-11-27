import { Container, Graphics } from "pixi.js";
import animateElements from "../../../util/animateElements";

/**
 * Add container element to the stage
 * @param {import("../elementPlugin").AddElementOptions} params
 */
export const addContainer = async ({
  app,
  parent,
  element,
  animations,
  eventHandler,
  animationPlugins,
  elementPlugins,
  signal,
}) => {
  const { id, x, y, children, scroll, alpha } = element;

  const container = new Container();
  container.label = id;
  let isAnimationDone = true;

  const drawContainer = () => {
    container.x = Math.round(x);
    container.y = Math.round(y);
    container.alpha = alpha;
  };

  const abortHandler = async () => {
    if (!isAnimationDone) {
      drawContainer();
    }
  };

  signal.addEventListener("abort", abortHandler);
  drawContainer();
  parent.addChild(container);

  if (children && children.length > 0) {
    for (const child of children) {
      const childPlugin = elementPlugins.find((p) => p.type === child.type);
      if (!childPlugin) {
        throw new Error(
          `No plugin found for child element type: ${child.type}`,
        );
      }

      await childPlugin.add({
        app,
        parent: container,
        element: child,
        animations,
        eventHandler,
        animationPlugins,
        animateElements,
        elementPlugins,
        signal,
      });
    }
  }

  if (scroll) {
    setupScrolling({
      container,
      element,
    });
  }

  if (animations && animations.length > 0) {
    isAnimationDone = false;
    await animateElements(id, animationPlugins, {
      app,
      element: container,
      animations,
      signal,
    });
  }
  isAnimationDone = true;

  signal.removeEventListener("abort", abortHandler);
};

/**
 * @param {import("../../../types").SetupScrollingOptions} params
 * @returns
 */
export const setupScrolling = ({ container, element }) => {
  let totalWidth = 0;
  let totalHeight = 0;

  element.children.forEach((child) => {
    totalWidth = Math.max(child.width + child.x, totalWidth);
    totalHeight = Math.max(child.height + child.y, totalHeight);
  });

  // Only apply scrolling if scroll is enabled and content overflows
  const needsVerticalScroll =
    element.scroll && element.height && totalHeight > element.height;
  const needsHorizontalScroll =
    element.scroll && element.width && totalWidth > element.width;

  if (needsVerticalScroll || needsHorizontalScroll) {
    // Create a content container that will hold all the children
    const contentContainer = new Container();

    // Move all children from the main container to the content container
    const children = [...container.children];
    children.forEach((child) => {
      contentContainer.addChild(child);
    });

    // Add the content container back to the main container
    container.addChild(contentContainer);

    // Create clipping mask
    const clip = new Graphics()
      .rect(0, 0, element.width || totalWidth, element.height || totalHeight)
      .fill({ color: 0xff0000, alpha: 0 }); // Transparent mask
    container.addChild(clip);

    // Apply the mask to the content container
    contentContainer.mask = clip;

    // Enable mouse events on the container
    container.eventMode = "static";

    let scrollYOffset = 0;
    let scrollXOffset = 0;
    let minScrollY = -(totalHeight - (element.height || totalHeight));
    let minScrollX = -(totalWidth - (element.width || totalWidth));

    container.on("wheel", (e) => {
      e.preventDefault(); // Prevent page scrolling

      // Handle vertical scrolling
      if (needsVerticalScroll && e.deltaY !== 0) {
        const newScrollY = scrollYOffset - e.deltaY;

        // Boundary checking
        if (newScrollY > 0) {
          // At top edge
          scrollYOffset = 0;
        } else if (newScrollY < minScrollY) {
          // At bottom edge
          scrollYOffset = minScrollY;
        } else {
          // Normal scrolling
          scrollYOffset = newScrollY;
        }

        contentContainer.y = scrollYOffset;
      }

      // Handle horizontal scrolling (shift+wheel or deltaX)
      if (
        needsHorizontalScroll &&
        (e.deltaX !== 0 || (e.shiftKey && e.deltaY !== 0))
      ) {
        const deltaX = e.deltaX !== 0 ? e.deltaX : e.deltaY;
        const newScrollX = scrollXOffset - deltaX;

        // Boundary checking
        if (newScrollX > 0) {
          // At left edge
          scrollXOffset = 0;
        } else if (newScrollX < minScrollX) {
          // At right edge
          scrollXOffset = minScrollX;
        } else {
          // Normal scrolling
          scrollXOffset = newScrollX;
        }

        contentContainer.x = scrollXOffset;
      }
    });
  }
};
