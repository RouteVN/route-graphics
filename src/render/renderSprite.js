import { Sprite, Texture } from "pixi.js";
import transitionElements from "../transition/index.js";
import { subscribeClickEvents, subscribeHoverEvents } from "../util/eventSubscribers.js";

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

  const overCb = ()=>{
    if(clickEvents?.src){
      const clickTexture = clickEvents.src ? Texture.from(clickEvents.src) : Texture.EMPTY;
      sprite.texture = clickTexture;
    }
  }

  const outCb = ()=>{sprite.texture = texture;}

  const clickCb = ()=>{
    if(clickEvents?.src){
      const clickTexture = clickEvents.src ? Texture.from(clickEvents.src) : Texture.EMPTY;
      sprite.texture = clickTexture;
    }
  }

  if(eventHandler && hoverEvents){
    subscribeHoverEvents(sprite,eventHandler,hoverEvents,{
      overCb,
      outCb
    })
  }

  if(eventHandler && clickEvents){
    subscribeClickEvents(sprite,eventHandler,clickEvents,{clickCb})
  }

  parent.addChild(sprite);

  if (transitions && transitions.length > 0) {
    await transitionElements( id, {app, sprite, transitions, signal})
  }
}
