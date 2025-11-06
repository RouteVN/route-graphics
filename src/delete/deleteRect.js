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
 * @param {ASTNode} params.rectASTNode
 * @param {Object[]} params.transitions
 * @param {AbortSignal} params.signal
 */
export async function deleteRect({app, parent, rectASTNode, transitions, signal}){
    if (signal?.aborted) {
        return;
    }

    const rect = parent.getChildByLabel(rectASTNode.id)

    if(rect){
        const deleteElement = () => {
            if (rect && !rect.destroyed) {
                rect.destroy()
            }
        }

        if (transitions && transitions.length > 0) {
            await transitionElements(rectASTNode.id, {app, sprite: rect, transitions, signalAbortCb: deleteElement, signal});
        }
        deleteElement()
    }
}