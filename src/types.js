/**
 * @typedef {import('pixi.js').Application} Application
 * @typedef {import('pixi.js').Container} Container
 */

/**
 * @typedef {Object} BaseElement
 * @property {string} id - Unique identifier for the element
 * @property {string} type - Type of the element
 */

/**
 * @typedef {Object} PositionAfterAnchorOptions
 * @property {{x: number, y: number}} position - Object with x/y coordinates
 * @property {{width: number, height: number}} dimensions - Object with width/height
 * @property {{anchorX: number, anchorY: number}} anchor - Object with anchorX/anchorY
 */

/**
 * @typedef {Object} PositionAfterAnchor
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} ParseCommonObjectOption
 * @property {number} providedWidth
 * @property {number} providedHeight
 */

/**
 * @typedef {Object} HoverProps
 * @property {string} soundSrc
 * @property {string} cursor
 * @property {Object} actionPayload
 */

/**
 * @typedef {Object} ClickProps
 * @property {string} soundSrc
 * @property {Object} actionPayload
 */

/**
 * @typedef {Object} ComputedNode
 * @property {string} type - Type of the computed node
 * @property {string} id - ID of the computed node
 * @property {number} x - X position of the computed node
 * @property {number} y - Y position of the computed node
 * @property {number} width - Width of the computed node
 * @property {number} height - Height of the computed node
 * @property {number} originX
 * @property {number} originY
 * @property {number} scaleX
 * @property {number} scaleY
 */

/**
 * @typedef {Object} SpriteComputedProps
 * @property {'sprite'} type
 * @property {number} alpha
 * @property {string} url
 * @property {SpriteHover} hover
 * @property {SpriteClick} click
 * @typedef {ComputedNode & SpriteComputedProps } SpriteComputedNode
 */

/**
 * @typedef SpriteHoverProps
 * @property {string} src
 * @typedef {(SpriteHoverProps & HoverProps)} SpriteHover
 */

/**
 * @typedef SpriteClickProps
 * @property {string} src
 * @typedef {(SpriteClickProps & HoverProps)} SpriteClick
 */

/**
 * @typedef {Object} SliderComputedProps
 * @property {'slider'} type
 * @property {number} alpha
 * @property {string} direction
 * @property {string} thumbSrc
 * @property {string} barSrc
 * @property {number} min
 * @property {number} max
 * @property {number} step
 * @property {number} initialValue
 * @property {SliderHover} hover
 * @property {SliderDrag} drag
 * @property {SliderDragStart} dragStart
 * @property {SliderDragEnd} dragEnd
 * @typedef {ComputedNode & SliderComputedProps} SliderComputedNode
 */

/**
 * @typedef {Object} SliderHover
 * @property {string} thumbSrc
 * @property {string} barSrc
 * @property {string} cursor
 * @property {string} soundSrc
 */

/**
 * @typedef {Object} SliderDrag
 * @property {Object} actionPayload
 */

/**
 * @typedef {Object} SliderDragStart
 * @property {Object} actionPayload
 */

/**
 * @typedef {Object} SliderDragEnd
 * @property {Object} actionPayload
 */

/**
 * @typedef {Object} AnimatedSpriteComputedProps
 * @property {'animated-sprite'} type
 * @property {string} spritesheetSrc
 * @property {Object} spritesheetData - Direct spritesheet metadata JSON data
 * @property {number} alpha
 * @property {Object} animation
 * @property {number[]} animation.frames - Array of frame indexes for the animation sequence
 * @property {number} animation.animationSpeed - Animation speed multiplier
 * @property {boolean} [animation.loop=true] - Whether the animation should loop
 * @typedef {ComputedNode & AnimatedSpriteComputedProps} AnimatedSpriteComputedNode
 */

/**
 * @typedef {Object} ParticleTextureShape
 * @property {'circle' | 'ellipse' | 'rect'} shape - Shape type
 * @property {number} [radius] - Radius for circle shape
 * @property {number} [width] - Width for ellipse/rect shapes
 * @property {number} [height] - Height for ellipse/rect shapes
 * @property {string} [color] - Fill color (hex)
 */

/**
 * @typedef {string | ParticleTextureShape} ParticleTexture
 */

/**
 * @typedef {Object} ParticleBehavior
 * @property {string} type - Behavior type name
 * @property {Object} [config] - Behavior-specific configuration
 */

/**
 * @typedef {Object} ParticleEmitterLifetime
 * @property {number} min - Minimum particle lifespan in seconds
 * @property {number} max - Maximum particle lifespan in seconds
 */

/**
 * @typedef {Object} ParticleSpawnBounds
 * @property {number} x - X position
 * @property {number} y - Y position
 * @property {number} width - Width
 * @property {number} height - Height
 */

/**
 * @typedef {Object} ParticleEmitter
 * @property {ParticleEmitterLifetime} lifetime - Particle lifespan in seconds
 * @property {number} frequency - Seconds between spawns (0 = burst all at once)
 * @property {number} particlesPerWave - Particles spawned per wave
 * @property {number} [maxParticles] - Maximum active particles
 * @property {number} [emitterLifetime] - How long emitter runs in seconds (-1 = infinite)
 * @property {ParticleSpawnBounds} [spawnBounds] - Recycle boundary
 * @property {boolean} [recycleOnBounds] - Recycle particles leaving bounds
 * @property {number} [seed] - Seed for deterministic randomness
 */

/**
 * @typedef {Object} ParticlesComputedProps
 * @property {'particles'} type
 * @property {number} count - Max particles count
 * @property {ParticleTexture} texture - Texture name or custom texture configuration
 * @property {ParticleBehavior[]} behaviors - Behavior configurations
 * @property {ParticleEmitter} emitter - Emitter configuration
 * @property {number} alpha - Container opacity
 * @typedef {ComputedNode & ParticlesComputedProps} ParticlesComputedNode
 */

/**
 * @typedef {Object} ContainerComputedProps
 * @property {'container'} type
 * @property {'horizontal' | 'vertical'} direction
 * @property {SpriteComputedNode | TextComputedNode | RectComputedNode | ContainerComputedNode} children
 * @property {number} gap
 * @property {number} rotation
 * @property {boolean} scroll
 * @property {boolean} [anchorToBottom]
 * @property {HoverProps} hover
 * @property {ClickProps} click
 * @property {ClickProps} rightClick
 * @typedef {ComputedNode & ContainerComputedProps } ContainerComputedNode
 */

/**
 * @typedef {Object} SetupScrollingOptions
 * @property {Container} container - The PIXI Container to enable scrolling on
 * @property {ContainerContainerElement} element - The container element
 */

/**
 * @typedef {Object} SetupClipping
 * @property {Container} container - The PIXI Container to enable scrolling on
 * @property {ContainerContainerElement} element - The container element
 */

/**
 * @typedef {Object} RenderAppOptions
 * @property {Application} app
 * @property {Container} parent
 * @property {ComputedNode[]} prevComputedTree
 * @property {ComputedNode[]} nextComputedTree
 * @property {Object[]} animations
 * @property {Function} eventHandler
 * @property {AbortSignal} [signal]
 */

/**
 * @typedef {Object} AnimateElementsOptions
 * @property {import('./RouteGraphics').ApplicationWithSoundStage} app
 * @property {Container} parent
 * @property {SpriteComputedNode} spriteComputedNode
 * @property {Object[]} animations
 * @param {Function} params.transitionElements
 * @property {Function} signalAbortCb
 * @property {AbortSignal} signal
 */

/**
 * @typedef {Object} RectComputedProps
 * @property {'rect'} type
 * @property {string} fill - Fill color (e.g., "red")
 * @property {Object} border
 * @property {number} border.width
 * @property {string} border.color
 * @property {number} border.alpha
 * @property {string} cursor - Cursor style (e.g., "pointer")
 * @property {string} pointerDown - Event name for pointer down
 * @property {string} pointerUp - Event name for pointer up
 * @property {string} pointerMove - Event name for pointer move
 * @property {number} rotation - Rotation in degrees
 * @property {HoverProps} hover
 * @property {ClickProps} click
 * @typedef {(ComputedNode & RectComputedProps)} RectComputedNode
 */

/**
 * @typedef TextHoverProps
 * @property {Object} textStyle
 * @typedef {(TextHoverProps & HoverProps)} TextHover
 */

/**
 * @typedef TextClickProps
 * @property {Object} textStyle
 * @typedef {(TextClickProps & HoverProps)} TextClick
 */

/**
 * @typedef {Object} TextStyle
 * @property {string} fill - Text color
 * @property {string} fontFamily - Font family
 * @property {number} fontSize - Font size in pixels
 * @property {'left' | 'center' | 'right'} align - Text alignment
 * @property {number} lineHeight - Line height multiplier
 * @property {boolean} wordWrap - Enable word wrapping
 * @property {boolean} breakWords - Allow breaking words when wrapping
 * @property {number} wordWrapWidth - Word wrap width
 * @property {string} [strokeColor] - Text stroke/outline color
 * @property {number} [strokeWidth] - Text stroke/outline width
 */

/**
 * @typedef {Object} TextComputedProps
 * @property {string} content - The text content to display
 * @property {Object} textStyle - Text style object
 * @property {TextHover} [hover]
 * @property {TextClick} [click]
 * @typedef {ComputedNode & TextComputedProps} TextComputedNode
 */

/**
 * @typedef {Object} TextRevealingComputedProps
 * @property {Array<TextChunk>} content - Array of processed text chunks (lines)
 * @property {number} [width] - Width constraint for text wrapping
 * @property {number} alpha - Opacity/transparency (0-1)
 * @property {Object} textStyle - Default text style
 * @property {number} [speed=50] - Animation speed (default: 50)
 * @property {Object} complete - Complete event
 * @property {Object} [indicator] - Settings for the text continuation indicator
 * @property {Object} [indicator.revealing] - Settings for the revealing state indicator
 * @property {string} [indicator.revealing.src] - Source of the indicator image while text is revealing
 * @property {number} [indicator.revealing.width] - Width of the indicator image while revealing
 * @property {number} [indicator.revealing.height] - Height of the indicator image while revealing
 * @property {Object} [indicator.complete] - Settings for the complete state indicator
 * @property {string} [indicator.complete.src] - Source of the indicator image when text revealing is finished
 * @property {number} [indicator.complete.width] - Width of the indicator image when complete
 * @property {number} [indicator.complete.height] - Height of the indicator image when complete
 * @property {'typewriter' | 'none'} [revealEffect='typewriter'] - Text reveal effect (typewriter = normal animation, none = skip animation)
 * @typedef {ComputedNode & TextRevealingComputedProps} TextRevealingComputedNode
 */

/**
 * @typedef {Object} TextChunk
 * @property {Array<TextPart>} lineParts - Text and furigana parts in this line
 * @property {number} y - Vertical position of this line
 * @property {number} lineMaxHeight - Maximum height of text in this line
 */

/**
 * @typedef {Object} TextPart
 * @property {string} text - Text content
 * @property {Object} textStyle - Text style
 * @property {number} x - Horizontal position
 * @property {number} y - Vertical position (relative to line, usually 0)
 * @property {FuriganaPart} furigana
 */

/**
 * @typedef {Object} FuriganaPart
 * @property {string} text - Furigana text
 * @property {Object} textStyle - Furigana text style
 * @property {number} x - Horizontal position (centered above parent)
 * @property {number} y - Vertical position (negative, above parent text)
 */

/**
 * @typedef {Object} PositionAfterAnchorOptions
 * @property {number} positionX
 * @property {number} positionY
 * @property {number} width
 * @property {number} height
 * @property {number} anchorX
 * @property {number} anchorY
 */

/**
 * @typedef {Object} PositionAfterAnchor
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} SpriteDimension
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {Object} DiffElementResult
 * @property {ComputedNode[]} toAddElement
 * @property {ComputedNode[]} toDeleteElement
 * @property {{"prev":ComputedNode[],"next":ComputedNode[]}} toUpdateElement
 */

/**
 * @typedef {Object} SoundElement
 * @property {string} id - Unique identifier
 * @property {string} type - Should be "sound"
 * @property {string} src - Source of the sound
 * @property {number} [volume=800] - Volume (0-1000+, 800 default)
 * @property {boolean} [loop=false] - Whether to loop the sound
 * @property {number} [delay=0] - Delay in milliseconds before playing
 */

/**
 * @typedef {Object} ContainerElementOptions
 * @property {number} [x] - The x-coordinate
 * @property {number} [y] - The y-coordinate
 * @property {number} [xp] - The x-coordinate in percentage
 * @property {number} [yp] - The y-coordinate in percentage
 * @property {number} [xa] - X Anchor
 * @property {number} [ya] - Y Anchor
 * @property {number} [width] - Width
 * @property {number} [height] - Height
 *
 * @typedef {BaseElement & ContainerElementOptions} ContainerElement
 */
/**
 * @readonly
 * @enum {string}
 */
export const WhiteListTransitionProps = {
  alpha: "alpha",
  x: "x",
  y: "y",
  scaleX: "scaleX",
  scaleY: "scaleY",
  rotation: "rotation",
};

/**
 * @readonly
 * @enum {string[]}
 */
export const TRANSITION_PROPERTY_PATH_MAP = {
  scaleX: ["scale", "x"],
  scaleY: ["scale", "y"],
  x: ["x"],
  y: ["y"],
  alpha: ["alpha"],
  rotation: ["rotation"],
};

/**
 * @readonly
 * @enum {string}
 */
export const TransitionEvent = {
  Add: "add",
  Remove: "remove",
  Update: "update",
};

/**
 * @readonly
 * @enum {string}
 */
export const ComputedNodeType = {
  RECT: "rect",
  TEXT: "text",
  CONTAINER: "container",
  SPRITE: "sprite",
  TEXT_REVEALING: "text-revealing",
  SLIDER: "slider",
  PARTICLES: "particles",
  ANIMATED_SPRITE: "animated-sprite",
  VIDEO: "video",
};

/**
 * @readonly
 * @enum {string}
 */
export const AudioType = {
  SOUND: "sound",
};

/**
 * Default text style configuration
 * @readonly
 * @type {import('pixi.js').TextStyleOptions}
 */
export const DEFAULT_TEXT_STYLE = {
  fill: "black",
  fontFamily: "Arial",
  fontSize: 16,
  align: "left",
  lineHeight: 1.2,
  wordWrap: false,
  breakWords: false,
  strokeColor: "transparent",
  strokeWidth: 0,
  wordWrapWidth: 0,
};

/**
 * @typedef {Object} BaseTransition
 * @property {string} type - Type of the transition
 * @property {string} targetId - ID of the element
 * @property {TransitionEvent} event - Event of the transition
 */

/**
 * @typedef {Object} GlobalConfiguration
 * @property {Object} [cursorStyles] - Global cursor styles configuration
 * @property {string} [cursorStyles.default] - Default cursor style
 * @property {string} [cursorStyles.hover] - Hover cursor style
 * @property {string} [cursorStyles.disabled] - Disabled cursor style
 * @property {string} [cursorStyles.loading] - Loading cursor style
 */

/**
 * @template {BaseElement} E
 * @template {BaseTransition} T
 * @typedef {Object} RouteGraphicsState
 * @property {string} id - ID
 * @property {E[]} elements - Array of elements
 * @property {T[]} animations - Array of animations
 * @property {GlobalConfiguration} [global] - Global configuration options
 */

/**
 * @typedef {Object} RouteGraphicsInitOptions
 * @property {number} width - Width of the renderer
 * @property {number} height - Height of the renderer
 * @property {string} backgroundColor - Background color of the renderer
 * @property {Function} eventHandler - Event handler function
 * @property {BaseRendererPlugin[]} plugins - Array of renderer plugins
 */

/**
 * @typedef {Object} RouteGraphicsPlugins
 * @property {import('./plugins/elements/elementPlugin').ElementPlugin[]} elementPlugins
 * @property {import('./plugins/animations/animationPlugin').AnimationPlugin[]} animationPlugins
 * @property {import('./plugins/audio/audioPlugin').AudioPlugin[]} audioPlugins
 */

/**
 * @typedef {Object} TextStyle
 * @property {'left' | 'center' | 'right'} align - The alignment of the text
 * @property {string} fill - The fill color of the text
 * @property {number} fontSize - The font family of the text
 * @property {string} fontWeight - The font weight of the text
 * @property {number} lineHeight - The line height of the text
 * @property {number} wordWrapWidth - Wrap width
 * @property {boolean} wordWrap - Whether to word wrap
 * @property {string} fontFamily - The font family of the text
 * @property {string} strokeColor - The stroke color of the text
 * @property {number} strokeWidth - The stroke width of the text
 */

/**
 * @abstract
 */
export class BaseRouteGraphics {
  /**
   * Initializes the renderer with the given options
   * @param {RouteGraphicsInitOptions} options - Initialization options
   */
  init(options) {
    throw new Error("Method not implemented.");
  }

  /**
   * Renders the state
   * @param {RouteGraphicsState<any,any>} state - State to render
   */
  render(state) {
    throw new Error("Method not implemented.");
  }
}

/**
 * Renderer plugin for rendering elements
 * @abstract
 * @template {BaseElement} E
 * @template {BaseTransition} T
 */
export class BaseRendererPlugin {
  /**
   * Name of the renderer
   * @type {string}
   */
  rendererName;

  /**
   * Type of the renderer
   * @type {string}
   *
   */
  rendererType;

  /**
   * Adds an element to the application stage
   * @param {import('./RouteGraphics').ApplicationWithSoundStage} app - The PixiJS application instance
   * @param {Object} options
   * @param {Container} options.parent - The parent container to add the element to
   * @param {E} options.element - The sprite element to add
   * @param {T[]} [options.animations=[]] - Array of animations
   * @param {Function} options.getTransitionByType - Function to get a transition by type
   * @param {Function} options.getRendererByElement
   * @param {AbortSignal} [signal] - Optional AbortSignal for cancellation
   * @returns {Promise<void>}
   */
  add = async (app, options, signal) => {
    throw new Error("Method not implemented.");
  };

  /**
   * Removes an element from the application stage
   * @param {import('./RouteGraphics').ApplicationWithSoundStage} app - The PixiJS application instance
   * @param {Object} options
   * @param {Container} options.parent
   * @param {Object} options.element - The sprite element to remove
   * @param {E} options.element - The element to remove
   * @param {T[]} [options.animations=[]] - Array of animations
   * @param {Function} options.getTransitionByType - Function to get a transition by type
   * @param {AbortSignal} [signal] - Optional AbortSignal for cancellation
   * @returns {Promise<void>}
   */
  remove = async (app, options, signal) => {
    throw new Error("Method not implemented.");
  };

  /**
   * Updates an element on the application stage
   * @param {import('./RouteGraphics').ApplicationWithSoundStage} app - The PixiJS application instance
   * @param {Object} options
   * @param {Container} options.parent
   * @param {E} options.prevElement - The previous state of the sprite element
   * @param {E} options.nextElement - The next state of the sprite element
   * @param {T[]} [options.animations=[]] - Array of animations
   * @param {Function} options.getRendererByElement
   * @param {Function} options.getTransitionByType - Function to get a transition by type
   * @param {AbortSignal} [signal] - Optional AbortSignal for cancellation
   * @returns {Promise<void>}
   */
  update = async (app, options, signal) => {
    throw new Error("Method not implemented.");
  };
}

/**
 *
 */
export class AbstractTransitionPlugin {
  /**
   *
   * @param {Application} app
   * @param {Container} container
   * @param {Object} transition
   * @param {AbortSignal} [signal] - Optional AbortSignal for cancellation
   * @returns {Promise<void>}
   */
  add = async (app, container, transition, signal) => {
    throw new Error("Method not implemented.");
  };

  /**
   *
   * @param {Application} app
   * @param {Container} container
   * @param {Object} transition
   * @param {AbortSignal} [signal] - Optional AbortSignal for cancellation
   * @returns {Promise<void>}
   */
  remove = async (app, container, transition, signal) => {
    throw new Error("Method not implemented.");
  };
}
