import { AnimatedSprite, Spritesheet, Texture } from "pixi.js";
import { setupDebugMode } from "./util/debugUtils.js";

/**
 * Add animated sprite element to the stage
 * @param {import("../elementPlugin.js").AddElementOptions} params
 */
export const addAnimatedSprite = async ({
  app,
  parent,
  element,
  animations,
  animationBus,
  completionTracker,
  zIndex,
}) => {
  const {
    id,
    x,
    y,
    width,
    height,
    spritesheetSrc,
    spritesheetData,
    animation,
    alpha,
  } = element;

  const metadata = spritesheetData;
  const frameNames = Object.keys(metadata.frames);

  const spriteSheet = new Spritesheet(Texture.from(spritesheetSrc), metadata);
  await spriteSheet.parse();

  const frameTextures = animation.frames.map(
    (index) => spriteSheet.textures[frameNames[index]],
  );

  const animatedSprite = new AnimatedSprite(frameTextures);
  animatedSprite.label = id;
  animatedSprite.zIndex = zIndex;

  animatedSprite.animationSpeed = animation.animationSpeed ?? 0.5;
  animatedSprite.loop = animation.loop ?? true;

  if (!app.debug) animatedSprite.play();
  else setupDebugMode(animatedSprite, id, app.debug);

  animatedSprite.x = Math.round(x);
  animatedSprite.y = Math.round(y);
  animatedSprite.width = Math.round(width);
  animatedSprite.height = Math.round(height);
  animatedSprite.alpha = alpha;

  parent.addChild(animatedSprite);

  // Dispatch animations to the bus
  const relevantAnimations = animations?.filter((a) => a.targetId === id) || [];

  for (const animation of relevantAnimations) {
    const stateVersion = completionTracker.getVersion();
    completionTracker.track(stateVersion);

    animationBus.dispatch({
      type: "START",
      payload: {
        id: animation.id,
        element: animatedSprite,
        properties: animation.properties,
        targetState: { x, y, width, height, alpha },
        onComplete: () => {
          completionTracker.complete(stateVersion);
        },
      },
    });
  }
};
