import createRouteGraphics, {
    createAssetBufferManager,
    textPlugin,
    rectPlugin,
    spritePlugin,
    sliderPlugin,
    containerPlugin,
    textRevealingPlugin,
    particlesPlugin,
    tweenPlugin,
    soundPlugin
} from 'https://cdn.jsdelivr.net/npm/route-graphics@0.0.21/+esm'

import jsYaml from 'https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/+esm'

const templateInput = document.getElementById("input-template")
const highlightedTemplateInput = document.getElementById("highlighted-input-template")
const highlightedTemplateInputContent = document.getElementById("highlighted-input-template-content")

const outputCanvas = document.getElementById("output-canvas")
const exampleSelect = document.getElementById("template-select")

const prevButton = document.getElementById("prev-button")
const nextButton = document.getElementById("next-button")
const stateIndicator = document.getElementById("state-indicator")

const errorOverlay = document.getElementById("error-overlay")
const errorMessage = document.getElementById("error-message")

let app
let currentStates = []
let currentStateIndex = 0
let isInitialized = false
const seenAssets = new Set()
const assetBufferManager = createAssetBufferManager()

//Preload private assets
const privateAssets = {
    'circle-red': { type: 'texture', url: '/public/circle-red.png' },
    'circle-green': { type: 'texture', url: '/public/circle-green.png' },
    'circle-blue': { type: 'texture', url: '/public/circle-blue.png' },
    'horizontal-idle-thumb': { type: 'texture', url: '/public/horizontal_idle_thumb.png' },
    'horizontal-hover-thumb': { type: 'texture', url: '/public/horizontal_hover_thumb.png' },
    'horizontal-idle-bar': { type: 'texture', url: '/public/vertical_idle_bar.png' },
    'horizontal-hover-bar': { type: 'texture', url: '/public/vertical_hover_bar.png' },
    'bgm-1': { type: 'audio/', url: '/public/bgm-1.mp3' },
    'bgm-2': { type: 'audio/', url: '/public/bgm-2.mp3' },
    'bgm-3': { type: 'audio/', url: '/public/bgm-3.mp3' }
}

const preloadPrivateAssets = async () => {
    await loadAssets(privateAssets)
    Object.keys(privateAssets).forEach(key => seenAssets.add(key))
}

const recursivelyLoadAssets = (objects) => {
    const assets = {}

    const processObject = (obj) => {
        if (!obj || typeof obj !== 'object') return

        const possibleTextureAssetKeys = ['src', 'thumbSrc', 'barSrc']

        // Check all properties for src and soundSrc
        if(obj?.type !== 'sound'){
                possibleTextureAssetKeys.forEach(key => {
                    if (obj[key] && typeof obj[key] === 'string' && !seenAssets.has(obj[key])) {
                        assets[obj[key]] = { type: 'texture', url: obj[key] }
                        seenAssets.add(obj[key])
                    }
                })

            if (obj.soundSrc && typeof obj.soundSrc === 'string' && !seenAssets.has(obj.soundSrc)) {
                assets[obj.soundSrc] = { type: 'audio/', url: obj.soundSrc }
                seenAssets.add(obj.soundSrc)
            }
        }
        else if(obj?.type === "sound"){
            if (obj.src && typeof obj.src === 'string' && !seenAssets.has(obj.src)) {
                assets[obj.src] = { type: 'audio/', url: obj.src }
                seenAssets.add(obj.src)
            }
        }
        // Recursively process all object properties
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'object' && value !== null) {
                if (Array.isArray(value)) {
                    value.forEach(item => processObject(item))
                } else {
                    processObject(value)
                }
            }
        }
    }

    if (Array.isArray(objects)) {
        objects.forEach(obj => processObject(obj))
    } else {
        processObject(objects)
    }

    return assets
}

const loadAssets = async (assets) => {
    await assetBufferManager.load(assets)
    await app.loadAssets(assetBufferManager.getBufferMap())
}

const showError = (message) => {
    errorOverlay.classList.add('show')
    errorMessage.textContent = message
}

const hideError = () => {
    errorOverlay.classList.remove('show')
    errorMessage.textContent = ''
}

const initRouteGraphics = async () => {
    try {
        app = createRouteGraphics()

        await app.init({
            width: outputCanvas.parentElement.clientWidth,
            height: outputCanvas.parentElement.clientHeight,
            plugins: {
                elements: [
                    textPlugin,
                    rectPlugin,
                    spritePlugin,
                    sliderPlugin,
                    containerPlugin,
                    textRevealingPlugin,
                    particlesPlugin
                ],
                animations: [tweenPlugin],
                audio: [soundPlugin]
            },
            backgroundColor: "#1D1D1D",
            eventHandler: (eventName, payload) => {
                console.log('Route-Graphics Event:', eventName, payload)
            }
        })

        outputCanvas.appendChild(app.canvas)

        isInitialized = true
    } catch (error) {
        console.error('Failed to initialize Route-Graphics:', error)
        outputCanvas.style.display = 'none'
        const errorMsg = document.createElement('div')
        errorMsg.textContent = 'Failed to initialize Route-Graphics: ' + error.message
        outputCanvas.parentElement.appendChild(errorMsg)
    }
}

const loadTemplate = () => {
    const selectedTemplate = exampleSelect.value
    if (!selectedTemplate) return

    let templateData = {}
    try {
        templateData = jsYaml.load(decodeURIComponent(selectedTemplate))
    } catch (error) {
        console.error("Error parsing template data:", error)
        return
    }

    templateInput.value = jsYaml.dump(templateData.content)
    handleTextChange()
}

const updateAndHighlight = (highlightedInput, input) => {
    let text = input.value
    if (text[text.length - 1] === "\n") {
        text += " "
    }
    highlightedInput.innerHTML = text.replace(new RegExp("&", "g"), "&amp;").replace(new RegExp("<", "g"), "<")
    Prism.highlightElement(highlightedInput)
}

const syncScroll = (highlightedElement, element) => {
    highlightedElement.scrollTop = element.scrollTop
    highlightedElement.scrollLeft = element.scrollLeft
}

const renderCurrentState = async () => {
    if (!isInitialized || !app || currentStates.length === 0) {
        return
    }

    const currentState = currentStates[currentStateIndex]

    // Collect and load all assets from the current state
    const allElements = [...(currentState.elements || [])]
    const assets = recursivelyLoadAssets(allElements)
    if (Object.keys(assets).length > 0) {
        await loadAssets(assets)
    }

    const state = {
        elements: currentState.elements || [],
        animations: currentState.animations || [],
        audio: currentState.audio || [],
        global: {}
    }
    app.render(state)

    updateStateIndicator()
}

const updateStateIndicator = () => {
    if (currentStates.length > 1) {
        stateIndicator.textContent = `${currentStateIndex + 1} of ${currentStates.length}`
        stateIndicator.style.display = 'inline'
        prevButton.style.display = 'inline-block'
        nextButton.style.display = 'inline-block'

        prevButton.disabled = currentStateIndex === 0
        nextButton.disabled = currentStateIndex === currentStates.length - 1
    } else {
        stateIndicator.style.display = 'none'
        prevButton.style.display = 'none'
        nextButton.style.display = 'none'
    }
}

const handleTextChange = async () => {
    updateAndHighlight(highlightedTemplateInputContent, templateInput)

    try {
        hideError() 

        let data = {}
        try {
            data = jsYaml.load(templateInput.value)
        } catch (error) {
            console.error('Invalid YAML:', error.message)
            showError(`Invalid YAML: ${error.message}`)
            return
        }

        if (Array.isArray(data)) {
            currentStates = data
            currentStateIndex = 0
        } else {
            currentStates = [data]
            currentStateIndex = 0
        }

        await renderCurrentState()

    } catch (error) {
        console.error('Rendering error:', error)
        showError(`Rendering failed: ${error.message}`)
    }
}

const handlePrevScene = async () => {
    if (currentStateIndex > 0) {
        currentStateIndex--
        try {
            hideError()
            await renderCurrentState()
        } catch (error) {
            console.error('Rendering error:', error)
            showError(`Rendering failed: ${error.message}`)
        }
    }
}

const handleNextScene = async () => {
    if (currentStateIndex < currentStates.length - 1) {
        currentStateIndex++
        try {
            hideError()
            await renderCurrentState()
        } catch (error) {
            console.error('Rendering error:', error)
            showError(`Rendering failed: ${error.message}`)
        }
    }
}

const initDefaultTemplate = () => {
    if (exampleSelect.options.length > 1) {
        exampleSelect.selectedIndex = 1
        loadTemplate()
    } else {
        const defaultContent = {
            elements: [
                {
                    id: "welcome-text",
                    type: "text",
                    x: 640,
                    y: 360,
                    content: "Hello, Route-Graphics!",
                    anchorX: 0.5,
                    anchorY: 0.5,
                    textStyle: {
                        fill: "#ffffff",
                        fontSize: 32,
                        align: "center"
                    }
                }
            ]
        }
        templateInput.value = jsYaml.dump(defaultContent)
        handleTextChange()
    }
}

const injectEventListeners = () => {
    templateInput.addEventListener("input", handleTextChange)
    templateInput.addEventListener("scroll", () => syncScroll(highlightedTemplateInput, templateInput))
    exampleSelect.addEventListener("change", loadTemplate)

    if (prevButton) {
        prevButton.addEventListener("click", handlePrevScene)
    }

    if (nextButton) {
        nextButton.addEventListener("click", handleNextScene)
    }
}

const init = async () => {
    await initRouteGraphics()
    await preloadPrivateAssets()
    injectEventListeners()
    initDefaultTemplate()
}

init()