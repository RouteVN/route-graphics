import { Spritesheet, Texture } from "pixi.js";
import { setupDebugMode, cleanupDebugMode } from "./util/debugUtils.js";

/**
 * Update animated sprite element
 * @param {import("../elementPlugin.js").UpdateElementOptions} params
 */
export const updateAnimatedSprite = async ({
  app,
  parent,
  prevElement,
  nextElement,
  animations,
  animationBus,
  eventHandler,
  zIndex,
}) => {
  const animatedSpriteElement = parent.children.find(
    (child) => child.label === prevElement.id,
  );

  if (!animatedSpriteElement) return;

  animatedSpriteElement.zIndex = zIndex;

  const updateElement = async () => {
    if (JSON.stringify(prevElement) !== JSON.stringify(nextElement)) {
      animatedSpriteElement.x = Math.round(nextElement.x);
      animatedSpriteElement.y = Math.round(nextElement.y);
      animatedSpriteElement.width = Math.round(nextElement.width);
      animatedSpriteElement.height = Math.round(nextElement.height);
      animatedSpriteElement.alpha = nextElement.alpha;

      if (
        JSON.stringify(prevElement.animation) !==
        JSON.stringify(nextElement.animation)
      ) {
        animatedSpriteElement.animationSpeed =
          nextElement.animation.animationSpeed ?? 0.5;
        animatedSpriteElement.loop = nextElement.animation.loop ?? true;

        const metadata = nextElement.spritesheetData;
        const frameNames = Object.keys(metadata.frames);
        const spriteSheet = new Spritesheet(
          Texture.from(nextElement.spritesheetSrc),
          metadata,
        );
        await spriteSheet.parse();

        const frameTextures = nextElement.animation.frames.map(
          (index) => spriteSheet.textures[frameNames[index]],
        );
        animatedSpriteElement.textures = frameTextures;

        if (!app.debug) {
          animatedSpriteElement.play();
        } else {
          if (prevElement.id !== nextElement.id) {
            cleanupDebugMode(animatedSpriteElement);
            setupDebugMode(animatedSpriteElement, nextElement.id, app.debug);
          }
        }
      }
    }
  };

  const { x, y, width, height, alpha } = nextElement;

  // Dispatch animations to the bus
  const relevantAnimations =
    animations?.filter((a) => a.targetId === prevElement.id) || [];

  if (relevantAnimations.length > 0) {
    for (const animation of relevantAnimations) {
      animationBus.dispatch({
        type: "START",
        payload: {
          id: animation.id,
          element: animatedSpriteElement,
          properties: animation.properties,
          targetState: { x, y, width, height, alpha },
          onComplete: async () => {
            if (animation.complete) {
              eventHandler?.("complete", {
                _event: { id: animation.id, targetId: prevElement.id },
                ...animation.complete.actionPayload,
              });
            }
            await updateElement();
          },
        },
      });
    }
  } else {
    // No animations, update immediately
    await updateElement();
  }
};
