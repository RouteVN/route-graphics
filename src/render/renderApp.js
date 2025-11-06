
import { renderRect } from './renderRect.js';
import renderText from './renderText.js';
import { renderSprite } from './renderSprite.js';
import { renderContainer } from './renderContainer.js';
import { diffElements } from './common.js';
import { deleteRect } from '../delete/deleteRect.js';
import { deleteText } from '../delete/deleteText.js';
import { deleteContainer } from '../delete/deleteContainer.js';
import { deleteSprite } from '../delete/deleteSprite.js';
import { updateRect } from '../update/updateRect.js';
import { updateText } from '../update/updateText.js';
import { updateSprite } from '../update/updateSprite.js';
import { updateContainer } from '../update/updateContainer.js';
/**
 * @typedef {import('../types.js').Application} Application
 * @typedef {import('../types.js').ASTNode} ASTNode
 * @typedef {import('../types.js').Container} Container
 */


/**
 * @param {Application} app
 * @param {Container} parent 
 * @param {ASTNode[]} prevASTTree 
 * @param {ASTNode[]} nextASTTree 
 * @param {Object[]} transitions 
 * @param {Function} eventHandler
 * @param {AbortSignal[]} signal 
*/
export async function renderApp(app,parent,prevASTTree,nextASTTree,transitions,eventHandler,signal){
    const {toAddElement,toDeleteElement,toUpdateElement} = diffElements(prevASTTree,nextASTTree,transitions)
    const asyncActions = []

    for (const element of toDeleteElement){
        switch(element.type){
            case "rect":
                asyncActions.push(deleteRect({app, parent, rectASTNode: element, transitions, signal}));
                break;
            case "text":
                asyncActions.push(deleteText({app, parent, textASTNode: element, transitions, signal}));
                break;
            case "container":
                asyncActions.push(deleteContainer({app, parent, containerASTNode: element, transitions, signal}));
                break;
            case "sprite":
                asyncActions.push(deleteSprite({app, parent, spriteASTNode: element, transitions, signal}));
                break;
            default:
        }
    }

    for (const element of toAddElement) {
        switch(element.type){
            case "rect":
                asyncActions.push(renderRect({app, parent, rectASTNode: element, transitions, eventHandler, signal}));
                break;
            case "text":
                asyncActions.push(renderText({app, parent, textASTNode: element, transitions, eventHandler, signal}));
                break;
            case "container":
                asyncActions.push(renderContainer({app, parent, containerASTNode: element, transitions, eventHandler, signal}));
                break;
            case "sprite":
                asyncActions.push(renderSprite({app, parent, spriteASTNode: element, transitions, eventHandler, signal}));
                break;
            default:
        }
    }

    for (const {prev, next} of toUpdateElement) {
        switch(next.type) {
            case "rect":
                asyncActions.push(updateRect({app, parent, prevRectASTNode: prev, nextRectASTNode: next, transitions, eventHandler, signal}));
                break;
            case "text":
                asyncActions.push(updateText({app, parent, prevTextASTNode: prev, nextTextASTNode: next, transitions, eventHandler, signal}));
                break;
            case "container":
                asyncActions.push(updateContainer({app, parent, prevAST: prev, nextAST: next, transitions, eventHandler, signal}));
                break;
            case "sprite":
                asyncActions.push(updateSprite({app, parent, prevAST: prev, nextAST: next, transitions, eventHandler, signal}));
                break;
            default:
        }
    }
    await Promise.all(asyncActions);
    sortContainerChildren(parent,nextASTTree)
}

function sortContainerChildren(container, nextAST){
    container.children.sort((a, b) => {
        const aElement = nextAST.find(
            (element) => element.id === a.label,
        );
        const bElement = nextAST.find(
            (element) => element.id === b.label,
        );

        if (aElement && bElement) {
            // First, sort by zIndex if specified
            const aZIndex = aElement.zIndex ?? 0;
            const bZIndex = bElement.zIndex ?? 0;
            if (aZIndex !== bZIndex) {
            return aZIndex - bZIndex;
            }

            // If zIndex is the same or not specified, maintain order from nextState.elements
            const aIndex = nextAST.findIndex(
                (element) => element.id === a.label,
            );
            const bIndex = nextAST.findIndex(
                (element) => element.id === b.label,
            );
            return aIndex - bIndex;
        }

        // Keep elements that aren't in nextState.elements at their current position
        if (!aElement && !bElement) return 0;
        if (!aElement) return -1;
        if (!bElement) return 1;
    });
}