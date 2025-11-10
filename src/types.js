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
 * @typedef {Object} ASTNode
 * @property {string} type - Type of the AST node
 * @property {string} id - ID of the AST node
 * @property {number} x - X position of the AST node
 * @property {number} y - Y position of the AST node
 * @property {number} width - Width of the AST node
 * @property {number} height - Height of the AST node
 * @property {number} zIndex
 * @property {number} originX
 * @property {number} originY
 * @property {number} scaleX
 * @property {number} scaleY
 */

/**
 * @typedef {Object} SpriteASTProps
 * @property {'sprite'} type
 * @property {number} alpha
 * @property {string} url
 * @property {SpriteHover} hover
 * @property {SpriteClick} click
 * @typedef {ASTNode & SpriteASTProps } SpriteASTNode
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
 * @typedef {Object} ContainerASTProps
 * @property {'container'} type
 * @property {'horizontal' | 'vertical'} direction
 * @property {SpriteASTNode | TextASTNode | RectASTNode | ContainerASTNode} children
 * @property {number} gap
 * @property {number} rotation
 * @property {boolean} scroll
 * @typedef {ASTNode & ContainerASTProps } ContainerASTNode
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
 * @property {ASTNode[]} prevASTTree
 * @property {ASTNode[]} nextASTTree
 * @property {Object[]} transitions
 * @property {Function} eventHandler
 * @property {AbortSignal[]} signal
 */

/**
 * @typedef {Object} RenderElementOptions
 * @property {import('./RouteGraphics').ApplicationWithSoundStage} app
 * @property {Container} parent
 * @property {SpriteASTNode} spriteASTNode
 * @property {Object[]} transitions
 * @param {Function} params.transitionElements
 * @property {Function} signalAbortCb
 * @property {AbortSignal} signal
 */

/**
 * @typedef {Object} RectASTProps
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
 * @typedef {(ASTNode & RectASTProps)} RectASTNode
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
 * @typedef {Object} TextASTProps
 * @property {string} text
 * @property {number} wordWrapWidth
 * @property {boolean} breakWords
 * @property {number} width
 * @property {Object} [style] - Textstyle
 * @property {TextHover} hover
 * @property {TextClick} click
 * @typedef {ASTNode & TextASTProps} TextASTNode
 */

/**
 * @typedef {Object} TextRevealingASTProps
 * @property {Array<TextChunk>} content - Array of processed text chunks (lines)
 * @property {number} [width] - Width constraint for text wrapping
 * @property {number} alpha - Opacity/transparency (0-1)
 * @property {Object} textStyle - Default text style
 * @property {number} [speed=50] - Animation speed (default: 50)
 * @property {'typewriter' | 'none'} [revealEffect='typewriter'] - Text reveal effect (typewriter = normal animation, none = skip animation)
 * @typedef {ASTNode & TextRevealingASTProps} TextRevealingASTNode
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
 * @property {ASTNode[]} toAddElement
 * @property {ASTNode[]} toDeleteElement
 * @property {{"prev":ASTNode[],"next":ASTNode[]}} toUpdateElement
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
 * @typedef {Object} BaseTransition
 * @property {string} type - Type of the transition
 * @property {string} elementId - ID of the element
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
 * @property {T[]} transitions - Array of transitions
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
   * @param {T[]} [options.transitions=[]] - Array of transitions
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
   * @param {T[]} [options.transitions=[]] - Array of transitions
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
   * @param {T[]} [options.transitions=[]] - Array of transitions
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
