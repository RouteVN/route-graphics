import { Container } from "pixi.js";
import transitionElements from "../transition/index.js";

/**
 * @typedef {import('../types.js').ASTNode} ASTNode
 */

/**
 *
 * @param {Object} params
 * @param {import('../types.js').Application} params.app
 * @param {Container} params.parent
 * @param {ASTNode} params.spriteASTNode
 * @param {Object[]} params.transitions
 * @param {AbortSignal} params.signal
 */
export async function deleteSprite({app, parent, spriteASTNode, transitions, signal}){
    if (signal?.aborted) {
        return;
    }

    const sprite = parent.getChildByLabel(spriteASTNode.id)

    if(sprite){
        if (transitions && transitions.length > 0) {
            await transitionElements(spriteASTNode.id, {app, sprite, transitions, signal});
        }
        sprite.destroy()
    }
}