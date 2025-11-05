/**
 * @typedef {import("../types.js").ASTNode} ASTNode
 * @typedef {import("../types.js").DiffElementResult} DiffElementResult
 * @typedef {import("../types.js").HoverProps} HoverPops
 * @typedef {import("../types.js").ClickProps} ClickProps
 * @typedef {import("../types.js").Application} App
 */

/**
 * 
 * @param {ASTNode} prevElements 
 * @param {ASTNode} nextElements 
 * @param {Object[]} transitions
 * @returns {DiffElementResult}
 */
export function diffElements(prevElements, nextElements, transitions = []){
    const allIdSet = new Set()
    const prevElementMap = new Map()
    const nextElementMap = new Map()

    const toAddElement = []
    const toDeleteElement = []
    const toUpdateElement = []

    for(const element of prevElements){
        allIdSet.add(element.id)
        prevElementMap.set(element.id,element)
    }

    for(const element of nextElements){
        allIdSet.add(element.id)
        nextElementMap.set(element.id,element)
    }

    for(const id of allIdSet){
        const prevEl = prevElementMap.get(id)
        const nextEl = nextElementMap.get(id)

        if(!prevEl && nextEl){
            // New element
            toAddElement.push(nextEl)
        }
        else if(prevEl && !nextEl){
            // Element is deleted
            toDeleteElement.push(prevEl)
        }
        else if(JSON.stringify(prevEl) !== JSON.stringify(nextEl)
        || transitions.find(transition=>transition.elementId===nextEl.id)){
            //Update element
            toUpdateElement.push({
                prev: prevEl,
                next: nextEl
            })
        }
    }
    return {toAddElement,toDeleteElement,toUpdateElement}
}

/**
 * @param {App} app
 * @param {*} element 
 * @param {Function} eventHandler
 * @param {HoverPops} hover
 */
export function subscribeHoverEvents(app,element,eventHandler,hover){
    const { cursor, soundSrc, actionPayload } = hover
    element.eventMode = "static"
    
    if(actionPayload) element.on("pointerover",()=>{
        eventHandler(`${element.label}-pointer-over`,actionPayload)
    })

    if(cursor){
        element.on("pointerover",()=>{
            element.cursor = cursor
        })

        element.on("pointerout",()=>{
            element.cursor = "auto"
        })
    }
}

/**
 * 
 * @param {App} app 
 * @param {*} element 
 * @param {Function} eventHandler 
 * @param {ClickProps} click 
 */
export function subscribeClickEvents(app,element,eventHandler,click){
    const {soundSrc, actionPayload} = click
        
    if(actionPayload) element.on("pointerup",()=>{
        eventHandler(`${element.label}-pointer-up`,actionPayload)
    })
}