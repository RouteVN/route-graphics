import jsYaml from 'https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/+esm'

let routeGraphics
try {
    routeGraphics = await import('https://cdn.jsdelivr.net/npm/route-graphics@0.0.32/+esm')
} catch (error) {
    console.warn('Falling back to route-graphics@0.0.21', error)
    routeGraphics = await import('https://cdn.jsdelivr.net/npm/route-graphics@0.0.21/+esm')
}

const {
    default: createRouteGraphics,
    createAssetBufferManager,
    textPlugin,
    rectPlugin,
    spritePlugin,
    sliderPlugin,
    containerPlugin,
    textRevealingPlugin,
    animatedSpritePlugin,
    particlesPlugin,
    tweenPlugin,
    soundPlugin
} = routeGraphics

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
let templatesCatalog = []
const templatesById = new Map()
let supportedElementTypes = new Set()
const seenAssets = new Set()
const assetBufferManager = createAssetBufferManager()

const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.avif', '.svg'])
const audioExtensions = new Set(['.mp3', '.wav', '.ogg', '.aac', '.m4a', '.flac'])

const getAssetExtension = (assetPath) => {
    if (typeof assetPath !== 'string') return ''
    const sanitized = assetPath.split('?')[0].split('#')[0]
    const lastDot = sanitized.lastIndexOf('.')
    if (lastDot < 0) return ''
    return sanitized.slice(lastDot).toLowerCase()
}

const inferAssetType = (assetPath, fallbackType = 'image/png') => {
    const ext = getAssetExtension(assetPath)
    if (imageExtensions.has(ext)) {
        if (ext === '.jpg') return 'image/jpeg'
        return `image/${ext.replace('.', '')}`
    }
    if (audioExtensions.has(ext)) {
        if (ext === '.mp3') return 'audio/mpeg'
        return `audio/${ext.replace('.', '')}`
    }
    return fallbackType
}

const queueAsset = (assets, key, type) => {
    if (!key || typeof key !== 'string' || seenAssets.has(key)) return

    assets[key] = { type, url: key }
    seenAssets.add(key)
}

//Preload private assets
const privateAssets = {
    'circle-red': { type: 'image/png', url: '/public/circle-red.png' },
    'circle-green': { type: 'image/png', url: '/public/circle-green.png' },
    'circle-blue': { type: 'image/png', url: '/public/circle-blue.png' },
    'horizontal-idle-thumb': { type: 'image/png', url: '/public/horizontal_idle_thumb.png' },
    'horizontal-hover-thumb': { type: 'image/png', url: '/public/horizontal_hover_thumb.png' },
    'horizontal-idle-bar': { type: 'image/png', url: '/public/horizontal_idle_bar.png' },
    'horizontal-hover-bar': { type: 'image/png', url: '/public/horizontal_hover_bar.png' },
    'vertical-idle-thumb': { type: 'image/png', url: '/public/vertical_idle_thumb.png' },
    'vertical-hover-thumb': { type: 'image/png', url: '/public/vertical_hover_thumb.png' },
    'vertical-idle-bar': { type: 'image/png', url: '/public/vertical_idle_bar.png' },
    'vertical-hover-bar': { type: 'image/png', url: '/public/vertical_hover_bar.png' },
    'slider': { type: 'image/png', url: '/public/slider.png' },
    'bgm-1': { type: 'audio/mpeg', url: '/public/bgm-1.mp3' },
    'bgm-2': { type: 'audio/mpeg', url: '/public/bgm-2.mp3' },
    'bgm-3': { type: 'audio/mpeg', url: '/public/bgm-3.mp3' }
}

const preloadPrivateAssets = async () => {
    await loadAssets(privateAssets)
    Object.keys(privateAssets).forEach(key => seenAssets.add(key))
}

const recursivelyLoadAssets = (objects) => {
    const assets = {}

    const processObject = (obj) => {
        if (!obj || typeof obj !== 'object') return

        if (obj.type === 'sound' && typeof obj.src === 'string') {
            queueAsset(assets, obj.src, inferAssetType(obj.src, 'audio/mpeg'))
        }

        if (obj.type === 'animated-sprite' && typeof obj.spritesheetSrc === 'string') {
            queueAsset(assets, obj.spritesheetSrc, inferAssetType(obj.spritesheetSrc, 'image/png'))
        }

        const possibleTextureAssetKeys = ['src', 'thumbSrc', 'barSrc', 'spritesheetSrc']
        possibleTextureAssetKeys.forEach((key) => {
            if (key === 'src' && obj.type === 'sound') {
                return
            }
            if (obj[key] && typeof obj[key] === 'string') {
                queueAsset(assets, obj[key], inferAssetType(obj[key], 'image/png'))
            }
        })

        if (obj.soundSrc && typeof obj.soundSrc === 'string') {
            queueAsset(assets, obj.soundSrc, inferAssetType(obj.soundSrc, 'audio/mpeg'))
        }

        // Recursively process all object properties
        for (const value of Object.values(obj)) {
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

const collectElementTypes = (states) => {
    const foundTypes = new Set()

    const processElementNode = (node) => {
        if (!node || typeof node !== 'object') return
        if (node.type && typeof node.type === 'string') {
            foundTypes.add(node.type)
        }

        if (Array.isArray(node.children)) {
            node.children.forEach(processElementNode)
        }
    }

    const stateArray = Array.isArray(states) ? states : [states]
    stateArray.forEach((state) => {
        const elements = state?.elements
        if (Array.isArray(elements)) {
            elements.forEach(processElementNode)
        }
    })

    return foundTypes
}

const getUnsupportedElementTypes = (states) => {
    const definedTypes = collectElementTypes(states)
    return [...definedTypes].filter((type) => !supportedElementTypes.has(type))
}

const showError = (message) => {
    errorOverlay.classList.add('show')
    errorMessage.textContent = message
}

const hideError = () => {
    errorOverlay.classList.remove('show')
    errorMessage.textContent = ''
}

const loadTemplatesCatalog = async () => {
    const response = await fetch('/public/playground/templates.yaml')
    if (!response.ok) {
        throw new Error(`Failed to load templates catalog (${response.status})`)
    }

    const yamlText = await response.text()
    const parsedTemplates = jsYaml.load(yamlText)
    if (!Array.isArray(parsedTemplates)) {
        throw new Error('Templates catalog must be a YAML array')
    }

    templatesCatalog = parsedTemplates
    templatesById.clear()
    templatesCatalog.forEach((template) => {
        if (template?.id) {
            templatesById.set(template.id, template)
        }
    })

    if (exampleSelect) {
        exampleSelect.innerHTML = ''
        const placeholderOption = document.createElement('option')
        placeholderOption.value = ''
        placeholderOption.textContent = 'Select template'
        exampleSelect.appendChild(placeholderOption)

        templatesCatalog.forEach((template) => {
            const option = document.createElement('option')
            option.value = template.id
            option.textContent = template.name || template.id
            exampleSelect.appendChild(option)
        })
    }
}

const initRouteGraphics = async () => {
    try {
        app = createRouteGraphics()
        const elementPlugins = [
            textPlugin,
            rectPlugin,
            spritePlugin,
            sliderPlugin,
            containerPlugin,
            textRevealingPlugin,
            animatedSpritePlugin,
            particlesPlugin
        ].filter(Boolean)
        supportedElementTypes = new Set(elementPlugins.map((plugin) => plugin.type))

        await app.init({
            width: outputCanvas.parentElement.clientWidth,
            height: outputCanvas.parentElement.clientHeight,
            plugins: {
                elements: elementPlugins,
                animations: [tweenPlugin].filter(Boolean),
                audio: [soundPlugin].filter(Boolean)
            },
            backgroundColor: "#000000",
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
    const selectedTemplateId = exampleSelect.value
    if (!selectedTemplateId) return

    const templateData = templatesById.get(selectedTemplateId)
    if (!templateData?.content) {
        console.error("Template not found:", selectedTemplateId)
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
    const assets = recursivelyLoadAssets(currentState)
    if (Object.keys(assets).length > 0) {
        await loadAssets(assets)
    }

    const state = {
        ...currentState,
        elements: currentState.elements || [],
        animations: currentState.animations || [],
        audio: currentState.audio || []
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

        const unsupportedTypes = getUnsupportedElementTypes(currentStates)
        if (unsupportedTypes.length > 0) {
            showError(
                `Unsupported element type(s) in this playground runtime: ${unsupportedTypes.join(', ')}`,
            )
            return
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
    await loadTemplatesCatalog()
    injectEventListeners()
    initDefaultTemplate()
}

init()
