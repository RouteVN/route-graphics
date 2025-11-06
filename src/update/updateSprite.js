import { Texture } from "pixi.js";
import transitionElements from "../transition/index.js";

/**
 * Update function for Sprite elements
 * @typedef {import('../types.js').SpriteASTNode} SpriteASTNode
 * @typedef {import('pixi.js').Container} Container
 */

/**
 * @param {Object} params
 * @param {import('../types.js').Application} params.app
 * @param {Container} params.parent
 * @param {SpriteASTNode} params.prevAST
 * @param {SpriteASTNode} params.nextAST
 * @param {Object[]} params.transitions
 * @param {Function} eventHandler
 * @param {AbortSignal} params.signal
 */
export async function updateSprite({app, parent, prevAST, nextAST, eventHandler, transitions, signal}) {
  if (signal?.aborted) {
    return;
  }

  
  const spriteElement = parent.children.find(child => child.label === prevAST.id);

  const updateElement = ()=>{
    if (JSON.stringify(prevAST) !== JSON.stringify(nextAST)) {
      if (prevAST.url !== nextAST.url) {
        const texture = nextAST.url ? Texture.from(nextAST.url) : Texture.EMPTY;
        spriteElement.texture = texture;
      }
  
      spriteElement.x = nextAST.x;
      spriteElement.y = nextAST.y;
      spriteElement.width = nextAST.width;
      spriteElement.height = nextAST.height;
  
      spriteElement.alpha = nextAST.alpha;
      spriteElement.zIndex = nextAST.zIndex;

      if(spriteElement._hoverCleanupCb) spriteElement._hoverCleanupCb()
      if(spriteElement._clickCleanupCb) spriteElement._clickCleanupCb()
      const hoverEvents = nextAST?.hover
      const clickEvents = nextAST?.click

      const overCb = ()=>{
        if(hoverEvents?.src){
          const hoverTexture = hoverEvents.src ? Texture.from(hoverEvents.src) : Texture.EMPTY;
          sprite.texture = hoverTexture;
        }
      }

      const outCb = ()=>{sprite.texture = nextAST.url ? Texture.from(nextAST.url) : Texture.EMPTY;}

      const clickCb = ()=>{
        if(clickEvents?.src){
          const clickTexture = clickEvents.src ? Texture.from(clickEvents.src) : Texture.EMPTY;
          sprite.texture = clickTexture;
        }
      }

      if(eventHandler && hoverEvents){
        subscribeHoverEvents(app,sprite,eventHandler,hoverEvents,{
          overCb,
          outCb
        })
      }

      if(eventHandler && clickEvents){
        subscribeClickEvents(app,sprite,eventHandler,clickEvents,{clickCb})
      }
    }
  }
  signal.addEventListener("abort",()=>{updateElement()})

  if (spriteElement) {
    if (transitions && transitions.length > 0) {
      await transitionElements(prevAST.id, {app, sprite: spriteElement, transitions, signal});
    }
    updateElement()
  }
    
}
