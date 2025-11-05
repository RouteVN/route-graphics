
import keyframeTransition from './keyframeTransition.js';
/**
 * @typedef {import('../types.js').RenderElementOptions} RenderElementOptions
 */


/**
 * 
 * @param {string} id 
 * @param {RenderElementOptions} renderOptions
 * @returns 
 */
export default async function transitionElements(id,{app,sprite,transitions,signalAbortCb,signal}){
    const transitionPromises = [];
    for (const transition of transitions) {
        if (transition.elementId === id) {
            transitionPromises.push(
                keyframeTransition( app, sprite, transition, signalAbortCb, signal)
            );
        }
    }
    return Promise.all(transitionPromises)
}