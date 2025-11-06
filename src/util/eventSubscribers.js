/**
 * @param {App} app
 * @param {*} element 
 * @param {Function} eventHandler
 * @param {HoverPops} hover
 * @param {Object} cbs
 * @param {Function} cbs.overCb
 * @param {Function} cbs.outCb
 */
export function subscribeHoverEvents(app,element,eventHandler,hover,cbs={}){
    const { cursor, soundSrc, actionPayload } = hover

    element.eventMode = "static"
    
    element.on("pointerover",()=>{
        if(actionPayload) eventHandler(`${element.label}-pointer-over`,actionPayload)
        if(cursor)  element.cursor = cursor
        if(soundSrc) app.audioStage.add({
          id: `${element.label}-pointer-over`,
          url: soundSrc,
          loop: false,
        })
        if(cbs.overCb) cbs.overCb()
    })

    element.on("pointerout",()=>{
        element.cursor = "auto"
        if(cbs.outCb) cbs.outCb()
    })
}

/**
 * 
 * @param {App} app 
 * @param {*} element 
 * @param {Function} eventHandler 
 * @param {ClickProps} click 
 * @param {Object} cbs
 * @param {Function} cbs.clickCb
 */
export function subscribeClickEvents(app,element,eventHandler, click, cbs={}){
    const {soundSrc, actionPayload} = click
    element.eventMode = "static"

    element.on("pointerup",()=>{
        if(actionPayload) eventHandler(`${element.label}-click`,actionPayload)
        if(soundSrc) app.audioStage.add({
          id: `${element.label}-click`,
          url: soundSrc,
          loop: false,
        })
        if(cbs.clickCb) cbs.clickCb()
    })
}