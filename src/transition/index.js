import keyFrameTransition from "./keyFrameTransition";

/**
 * @typedef {import('../types.js').RenderElementOptions} RenderElementOptions
 */

/**
 * 
 * @param {string} id 
 * @param {RenderElementOptions} renderOptions
 * @returns 
 */
export default async function transitionElements(id,{app,sprite,transitions,signal}){
    const transitionPromises = [];
    for (const transition of transitions) {
        if (transition.elementId === id) {
            transitionPromises.push(
                keyFrameTransition( app, sprite, transition, signal)
            );
        }
    }
    return Promise.all(transitionPromises)
}