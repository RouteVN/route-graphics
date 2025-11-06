import { Sprite, Texture } from "pixi.js";
import transitionElements from "../transition/index.js";
import { subscribeClickEvents, subscribeHoverEvents } from "./common.js";

/**
 * @typedef {import('../types.js').RenderElementOptions} RenderElementOptions
 */

/**
 *
 * @param {RenderElementOptions} params
 */
export async function renderSprite({app, parent, spriteASTNode, transitions, eventHandler, signal}) {
  if (signal?.aborted) {
    reject(new DOMException("Operation aborted", "AbortError"));
    return;
  }

  const {
    id,
    x,
    y,
    width,
    height,
    url,
    alpha,
    zIndex
  } = spriteASTNode;
  const texture = url ? Texture.from(url) : Texture.EMPTY;
  const sprite = new Sprite(texture);
  sprite.label = id;

  
  const drawSprite = () => {
    sprite.x = x;
    sprite.y = y;
    sprite.width = width;
    sprite.height = height;
    sprite.alpha = alpha;
    sprite.zIndex = zIndex;
  }

  signal.addEventListener("abort",()=>{drawSprite()})
  drawSprite()

  const hoverEvents = spriteASTNode?.hover
  const clickEvents = spriteASTNode?.click
  if(eventHandler && hoverEvents){
    subscribeHoverEvents(app,sprite,eventHandler,hoverEvents)
  }

  if(eventHandler && clickEvents){
    subscribeClickEvents(app,sprite,eventHandler,clickEvents)
  }

  if(clickEvents?.src){
    sprite.on("pointerup",()=>{
      const clickTexture = clickEvents.src ? Texture.from(clickEvents.src) : Texture.EMPTY;
      sprite.texture = clickTexture;
    })
  }

  if(hoverEvents?.src){
    sprite.on("pointerover",()=>{
      const hoverTexture = hoverEvents.src ? Texture.from(hoverEvents.src) : Texture.EMPTY;
      sprite.texture = hoverTexture;
    })

    sprite.on("pointerout",()=>{
      sprite.texture = texture;
    })
  }
  parent.addChild(sprite);

  if (transitions && transitions.length > 0) {
    await transitionElements( id, {app, sprite, transitions, signal})
  }
}
