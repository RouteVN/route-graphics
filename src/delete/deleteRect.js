import { Container } from "pixi.js";

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
 * @param {Function} params.transitionElements
 * @param {AbortSignal} params.signal
 */
export async function deleteRect({app, parent, rectASTNode, transitions, transitionElements, signal}){
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

        signal.addEventListener("abort",()=>{deleteElement()})

        if (transitions && transitions.length > 0) {
            await transitionElements(rectASTNode.id, {app, sprite: rect, transitions, signal});
        }
        deleteElement()
    }
}