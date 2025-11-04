import transitionElements from "../transition/index.js";

/**
 * Update function for Text elements
 * @typedef {import('../types.js').TextASTNode} TextASTNode
 * @typedef {import('pixi.js').Container} Container
 */

/**
 * @param {Object} params
 * @param {import('../types.js').Application} params.app
 * @param {Container} params.parent
 * @param {TextASTNode} params.prevTextASTNode
 * @param {TextASTNode} params.nextTextASTNode
 * @param {Object[]} params.transitions
 * @param {AbortSignal} params.signal
 */
export async function updateText({app, parent, prevTextASTNode, nextTextASTNode, transitions, signal}) {
    if (signal?.aborted) {
        return;
    }

    
    const textElement = parent.children.find(child => child.label === prevTextASTNode.id);
    
    if (textElement) {
        if (transitions && transitions.length > 0) {
            await transitionElements(prevTextASTNode.id, {app, sprite: textElement, transitions, signal});
        }
        
        if (JSON.stringify(prevTextASTNode) !== JSON.stringify(nextTextASTNode)) {
            textElement.text = nextTextASTNode.text;
    
            textElement.style = {
                fill: nextTextASTNode.style.fill,
                fontFamily: nextTextASTNode.style.fontFamily,
                fontSize: nextTextASTNode.style.fontSize,
                wordWrap: nextTextASTNode.style.wordWrap,
                breakWords: nextTextASTNode.style.breakWords,
                wordWrapWidth: nextTextASTNode.style.wordWrapWidth
            };
    
            textElement.x = nextTextASTNode.x;
            textElement.y = nextTextASTNode.y;
            textElement.zIndex = nextTextASTNode.zIndex;
        }
    }
}