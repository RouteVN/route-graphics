import transitionElements from "../transition/index.js";

/**
 * Update function for Rectangle elements
 * @typedef {import('../types.js').RectASTNode} RectASTNode
 * @typedef {import('pixi.js').Container} Container
 */

/**
 * @param {Object} params
 * @param {import('../types.js').Application} params.app
 * @param {Container} params.parent
 * @param {RectASTNode} params.prevRectASTNode
 * @param {RectASTNode} params.nextRectASTNode
 * @param {Object[]} params.transitions
 * @param {AbortSignal} params.signal
 */
export async function updateRect({app, parent, prevRectASTNode, nextRectASTNode, transitions, signal}) {
    if (signal?.aborted) {
        return;
    }

    
    const rectElement = parent.children.find(child => child.label === prevRectASTNode.id);
    
    if (rectElement) {
        if (transitions && transitions.length > 0) {
            await transitionElements(prevRectASTNode.id, {app, sprite: rectElement, transitions, signal});
        }
        
        if (JSON.stringify(prevRectASTNode) === JSON.stringify(nextRectASTNode)) {
            rectElement.clear();
    
            rectElement.rect(nextRectASTNode.x, nextRectASTNode.y, nextRectASTNode.width, nextRectASTNode.height)
                .fill(nextRectASTNode.fill);
    
            if (nextRectASTNode.border) {
                rectElement.stroke({
                    color: nextRectASTNode.border.color,
                    alpha: nextRectASTNode.border.alpha,
                    width: nextRectASTNode.border.width
                });
            }
    
            rectElement.zIndex = nextRectASTNode.zIndex;
        }
    }
}