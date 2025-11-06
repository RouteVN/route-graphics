import { Container } from "pixi.js";
import { renderApp } from '../render/renderApp.js';
import transitionElements from "../transition/index.js";

/**
 * Update function for Container elements
 * @typedef {import('../types.js').ContainerASTNode} ContainerASTNode
 * @typedef {import('pixi.js').Container} Container
 */

/**
 * @param {Object} params
 * @param {import('pixi.js').Application} params.app
 * @param {Container} params.parent
 * @param {ContainerASTNode} params.prevAST
 * @param {ContainerASTNode} params.nextAST
 * @param {Object[]} params.transitions
 * @param {AbortSignal} params.signal
 */
export async function updateContainer({app, parent, prevAST, nextAST, transitions, signal}) {
    if (signal?.aborted) {
        return;
    }

    
    const containerElement = parent.children.find(child => child.label === prevAST.id);
    const updateElement = async()=>{
        if (JSON.stringify(prevAST) !== JSON.stringify(nextAST)) {
            containerElement.x = nextAST.x;
            containerElement.y = nextAST.y;
            containerElement.zIndex = nextAST.zIndex;
            containerElement.label = nextAST.id;
    
            if(JSON.stringify(prevAST.children) !== JSON.stringify(nextAST.children)) {
                await renderApp(app, containerElement, prevAST.children, nextAST.children, transitions, signal);
            }
        }
    }
    signal.addEventListener("abort",async()=>{await updateElement()})

    if (containerElement) {
        if (transitions && transitions.length > 0) {
            await transitionElements(prevAST.id, {app, sprite: containerElement, transitions, signal});
        }
        
        await updateElement()
    }
}