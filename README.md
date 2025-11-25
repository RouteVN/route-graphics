## 🚀 Overview

Route Graphics is a declarative UI system that enables developers to create rich, interactive 2D interfaces through JSON configurations. Instead of manipulating DOM elements directly, you define your interface structure using JSON, and Route Graphics handles the rendering, animations, audio, and interactions automatically.

## 🏗️ Architecture Overview

Route Graphics follows a modular plugin architecture with three main plugin categories:

1. **Element Plugins** - Render visual elements (add/update/delete)
2. **Audio Plugins** - Handle audio playback
3. **Animation Plugins** - Handle dynamic content and transitions

Route Graphics is a declarative UI system that enables developers to create rich, interactive 2D interfaces through JSON configurations. Instead of manipulating DOM elements directly, you define your interface structure using JSON, and Route Graphics handles the rendering, animations, audios, and interactions automatically.

## 🛠️ Getting Started

### Installation

```bash
bun install route-graphics
```

### Basic Usage

```javascript
import createRouteGraphics, {
  textPlugin,
  rectPlugin,
  spritePlugin,
  sliderPlugin,
  containerPlugin,
  textRevealingPlugin,
  tweenPlugin,
  soundPlugin,
  createAssetBufferManager,
} from 'route-graphics';

// Define assets with URL and type
const assets = {
  "circle-red": {
    url: "/public/circle-red.png",
    type: "image/png",
  },
  "circle-blue": {
    url: "/public/circle-blue.png",
    type: "image/png",
  },
  "circle-green": {
    url: "/public/circle-green.png",
    type: "image/png",
  },
  "slider": {
    url: "/public/slider.png",
    type: "image/png",
  },
  "bgm-1": {
    url: "/public/bgm-1.mp3",
    type: "audio/mpeg",
  },
  "bgm-2": {
    url: "/public/bgm-2.mp3",
    type: "audio/mpeg",
  }
};

// Load assets using asset buffer manager
const assetBufferManager = createAssetBufferManager();
await assetBufferManager.load(assets);
const assetBufferMap = assetBufferManager.getBufferMap();

// Create and initialize app
const app = createRouteGraphics();
await app.init({
  width: 1280,
  height: 720,
  plugins: {
    elements: [
      textPlugin,
      rectPlugin,
      spritePlugin,
      sliderPlugin,
      containerPlugin,
      textRevealingPlugin
    ],
    animations: [
      tweenPlugin
    ],
    audios: [
      soundPlugin
    ],
  },
  eventHandler: (eventName, payload) => {
    console.log('Event:', eventName, payload);
  }
});

// Load assets into the app and add to DOM
await app.loadAssets(assetBufferMap);
document.body.appendChild(app.canvas);

// Render your UI
app.render({
  elements: [
    {
      id: "sprite1",
      type: "sprite",
      src: "file:circle-red",
      x: 100,
      y: 100,
      width: 64,
      height: 64,
      hover: {
        imageSrc: "file:circle-blue",
        soundSrc: "file:hover-sound"
      },
      click: {
        action: "handleClick",
        soundSrc: "file:click-sound"
      }
    }
  ],
  animations: [
    {
      id: "fadeIn",
      targetId: "sprite1",
      type: "tween",
      properties: {
        alpha: {
          initialValue: 0,
          keyframes: [
            { duration: 1000, value: 1, easing: "linear" }
          ]
        }
      }
    }
  ],
  audio: [
    {
      id: "bgMusic",
      type: "sound",
      src: "file:bgm-1",
      volume: 600,
      loop: true
    }
  ]
});
```

## 🏗️ Architecture Overview

Route Graphics follows a modular plugin architecture with three main plugin categories:

1. **Parser Plugins** - Convert JSON to Abstract Syntax Trees (AST)
2. **Element Plugins** - Render visual elements (add/update/delete)
3. **Audio & Animation Plugins** - Handle dynamic content


## 🎨 Element Plugins

Element plugins handle the creation, updating, and deletion of visual elements. Each plugin follows a consistent interface:

```javascript
createElementPlugin({
  type: "element-type",
  add: addFunction,      // Create element
  update: updateFunction, // Update existing element
  delete: deleteFunction  // Remove element
});
```

### Available Element Plugins

#### 🖼️ Sprite Plugin
Renders image-based sprites with rich interactions.

**Required Properties:**
- `id`, `type`, `x`, `y`, `width`, `height`

**Optional Properties:**
- `src`: Source of the sprite image (asset alias)
- `anchorX`, `anchorY`: Anchor points (default: 0)
- `alpha`: Opacity/transparency (0-1, default: 1)

**Events:**
- **click**: Triggered when sprite is clicked
  - `src` (string, optional): Change sprite image
  - `soundSrc` (string, optional): Play sound effect
  - `actionPayload` (object, optional): Custom data sent to event handler
- **hover**: Triggered when mouse enters/exits sprite
  - `src` (string, optional): Change sprite image
  - `soundSrc` (string, optional): Play sound effect
  - `cursor` (string, optional): CSS cursor style
  - `actionPayload` (object, optional): Custom data sent to event handler

**Example:**
```json
{
  "id": "character",
  "type": "sprite",
  "x": 100,
  "y": 100,
  "width": 64,
  "height": 64,
  "src": "hero-idle",
  "hover": {
    "src": "hero-hover",
    "cursor": "pointer",
    "soundSrc": "hover-sound",
    "actionPayload": { "action": "hoverHero" }
  },
  "click": {
    "src": "hero-active",
    "soundSrc": "click-sound",
    "actionPayload": { "action": "activateHero" }
  }
}
```

**Event Data Structure:**
- **Click Event:**
```json
{
  "_event": {
    "id": "character"
  },
  // All actionPayload properties are spread directly here
  "action": "activateHero"
}
```
- **Hover Event:**
```json
{
  "_event": {
    "id": "character"
  },
  // All actionPayload properties are spread directly here
  "action": "hoverHero"
}
```

#### 📝 Text Plugin
Renders styled text with comprehensive formatting options.

**Required Properties:**
- `id`, `type`, `x`, `y`

**Optional Properties:**
- `content`: Text content to display (default: "")
- `width`: Width constraint for text wrapping
- `anchorX`, `anchorY`: Anchor points (default: 0)
- `alpha`: Opacity (0-1, default: 1)
- `textStyle`: Complete text styling object

**TextStyle Options:**
- `fill`: Text color (default: "black")
- `fontFamily`: Font family
- `fontSize`: Font size in pixels (default: 16)
- `align`: Text alignment ["left", "center", "right"] (default: "left")
- `lineHeight`: Line height (default: 1.2)
- `wordWrap`: Enable word wrapping (default: true)
- `breakWords`: Allow breaking words (default: true)
- `strokeColor`: Text outline color
- `strokeWidth`: Text outline width

**Events:**
- **click**: Triggered when text is clicked
  - `textStyle` (object, optional): Change text styling
  - `soundSrc` (string, optional): Play sound effect
  - `actionPayload` (object, optional): Custom data sent to event handler
- **hover**: Triggered when mouse enters/exits text
  - `textStyle` (object, optional): Change text styling
  - `soundSrc` (string, optional): Play sound effect
  - `cursor` (string, optional): CSS cursor style
  - `actionPayload` (object, optional): Custom data sent to event handler

**Example:**
```json
{
  "id": "title",
  "type": "text",
  "x": 960,
  "y": 100,
  "content": "Welcome to Route Graphics",
  "textStyle": {
    "fill": "#ffffff",
    "fontFamily": "Arial",
    "fontSize": 48,
    "align": "center"
  },
  "hover": {
    "textStyle": { "fill": "#ffff00" },
    "cursor": "pointer",
    "soundSrc": "hover-sound",
    "actionPayload": { "action": "hoverTitle" }
  },
  "click": {
    "textStyle": { "fill": "#00ff00" },
    "soundSrc": "click-sound",
    "actionPayload": { "action": "clickTitle" }
  }
}
```

**Event Data Structure:**
- **Click Event:**
```json
{
  "_event": {
    "id": "title"
  },
  // All actionPayload properties are spread directly here
  "action": "clickTitle"
}
```
- **Hover Event:**
```json
{
  "_event": {
    "id": "title"
  },
  // All actionPayload properties are spread directly here
  "action": "hoverTitle"
}
```

#### ⬜ Rectangle Plugin
Creates filled and bordered rectangles with rotation support.

**Required Properties:**
- `id`, `type`, `width`, `height`

**Optional Properties:**
- `x`, `y`: Position (default: 0)
- `anchorX`, `anchorY`: Anchor points (default: 0)
- `alpha`: Opacity (0-1, default: 1)
- `fill`: Fill color (default: "white")
- `rotation`: Rotation in degrees (default: 0)
- `border`: Border styling object

**Border Options:**
- `width`: Border width in pixels (default: 0)
- `color`: Border color (default: "black")
- `alpha`: Border opacity (0-1, default: 1)

**Events:**
- **click**: Triggered when rectangle is clicked
  - `soundSrc` (string, optional): Play sound effect
  - `actionPayload` (object, optional): Custom data sent to event handler
- **hover**: Triggered when mouse enters/exits rectangle
  - `soundSrc` (string, optional): Play sound effect
  - `cursor` (string, optional): CSS cursor style
  - `actionPayload` (object, optional): Custom data sent to event handler

**Example:**
```json
{
  "id": "panel",
  "type": "rect",
  "x": 50,
  "y": 50,
  "width": 400,
  "height": 300,
  "fill": "0x333333",
  "border": {
    "width": 2,
    "color": "0xffffff",
    "alpha": 0.8
  },
  "alpha": 0.9,
  "hover": {
    "cursor": "pointer",
    "soundSrc": "hover-sound",
    "actionPayload": { "action": "hoverPanel" }
  },
  "click": {
    "soundSrc": "click-sound",
    "actionPayload": { "action": "clickPanel" }
  }
}
```

**Event Data Structure:**
For an element with `actionPayload: { action: "clickPanel", panelType: "settings" }`:

- **Click Event:**
```json
{
  "_event": {
    "id": "panel"
  },
  "action": "clickPanel",
  "panelType": "settings"
}
```

- **Hover Event:**
```json
{
  "_event": {
    "id": "panel"
  },
  "action": "hoverPanel",
  "panelType": "settings"
}
```

#### 📦 Container Plugin
Groups and manages layout of multiple elements.

**Required Properties:**
- `id`, `type`, `x`, `y`

**Optional Properties:**
- `width`, `height`: Container dimensions (calculated from children if not set)
- `anchorX`, `anchorY`: Anchor points (must be 0, 0.5, or 1 for containers)
- `alpha`: Opacity (0-1, default: 1)
- `children`: Array of child elements (default: [])
- `direction`: Layout layout ["absolute", "horizontal", "vertical"] (default: "absolute")
- `gap`: Spacing between children in pixels (default: 0)
- `rotation`: Rotation in degrees (default: 0)
- `scroll`: Enable scrolling for overflow content (default: false)

**Events:** None

**Layout Directions:**
- `absolute`: Manual positioning of children
- `horizontal`: Left-to-right arrangement
- `vertical`: Top-to-bottom arrangement

**Example:**
```json
{
  "id": "menu",
  "type": "container",
  "x": 0,
  "y": 0,
  "width": 200,
  "height": 400,
  "direction": "vertical",
  "gap": 10,
  "children": [
    {
      "id": "btn1",
      "type": "sprite",
      "x": 0,
      "y": 0,
      "width": 200,
      "height": 50,
      "src": "button-normal"
    },
    {
      "id": "btn2",
      "type": "sprite",
      "x": 0,
      "y": 60,
      "width": 200,
      "height": 50,
      "src": "button-normal"
    }
  ]
}
```

#### 🎭 Text Revealing Plugin
Animated text display with typewriter effects.

**Required Properties:**
- `id`, `type`, `x`, `y`

**Optional Properties:**
- `content`: Array of text segments with individual styling
- `width`: Width constraint for text wrapping
- `anchorX`, `anchorY`: Anchor points (default: 0)
- `alpha`: Opacity (0-1, default: 1)
- `textStyle`: Default text styling for all segments
- `speed`: Animation speed (default: 50)
- `revealEffect`: Animation type ["typewriter", "none"] (default: "typewriter")
- `indicator`: Continuation indicator settings

**Content Structure:**
```json
"content": [
  {
    "text": "Hello ",
    "textStyle": { "fill": "red" },  // Optional individual styling
    "furigana": {                   // Optional Japanese annotations
      "text": "こ",
      "textStyle": { "fontSize": 12 }
    }
  },
  { "text": "World!" }
]
```

**Indicator Options:**
- `revealing`: `src`, `width`, `height` - indicator during animation
- `complete`: `src`, `width`, `height` - indicator when finished
- `offset`: Distance between text and indicator (default: 12)

**Events:** None (Text Revealing elements do not support events)

**Example:**
```json
{
  "id": "story",
  "type": "textRevealing",
  "x": 100,
  "y": 200,
  "content": [
    { "text": "Hello ", "textStyle": { "fill": "red" } },
    { "text": "World!", "textStyle": { "fill": "blue" } }
  ],
  "speed": 50,
  "revealEffect": "typewriter"
}
```

#### 🎚️ Slider Plugin
Interactive slider controls for value input.

**Required Properties:**
- `id`, `type`, `x`, `y`, `direction`, `thumbSrc`, `barSrc`

**Optional Properties:**
- `anchorX`, `anchorY`: Anchor points (default: 0)
- `alpha`: Opacity (0-1, default: 1)
- `width`, `height`: Slider dimensions
- `min`: Minimum value (default: 0)
- `max`: Maximum value (default: 100)
- `step`: Value increment (default: 1, minimum: 0)
- `initialValue`: Starting value (default: 0)

**Events:**
- **hover**: Triggered when mouse enters/exits slider
  - `thumbSrc` (string, optional): Change thumb sprite image
  - `barSrc` (string, optional): Change bar sprite image
  - `soundSrc` (string, optional): Play sound effect
  - `cursor` (string, optional): CSS cursor style
- **change**: Triggered during slider drag with current value
  - `actionPayload` (object, optional): Custom data sent to event handler

**Example:**
```json
{
  "id": "volumeSlider",
  "type": "slider",
  "x": 100,
  "y": 500,
  "direction": "horizontal",
  "thumbSrc": "slider-thumb",
  "barSrc": "slider-bar",
  "min": 0,
  "max": 100,
  "step": 1,
  "initialValue": 50,
  "hover": {
    "thumbSrc": "slider-thumb-hover",
    "barSrc": "slider-bar-hover",
    "cursor": "pointer",
    "soundSrc": "slider-hover"
  },
  "change": {
    "actionPayload": {
      "action": "updateVolume"
    }
  }
}
```

**Event Data Structure:**
- **Hover Event:** None (slider hover doesn't trigger event data)
- **Change Event:** For a slider with `actionPayload: { action: "updateVolume" }` and current value of 75:
```json
{
  "_event": {
    "id": "volumeSlider",
    "value": 75
  },
  "action": "updateVolume"
}
```

## 🔊 Audio Plugin

Integrated audio system for sound effects and background music.

### Sound Plugin Properties

**Required Properties:**
- `id`, `type`, `src`

**Optional Properties:**
- `volume`: Volume level (default: 800, minimum: 0)
- `loop`: Whether to loop the audio (default: false)
- `delay`: Delay before playing in milliseconds (default: 0)

**Volume Details:**
- 0 = muted
- 1000 = original full volume
- Values above 1000 = amplified (may clip)

**Example:**
```json
{
  "id": "bgMusic",
  "type": "sound",
  "src": "bgm-level1",
  "volume": 800,
  "loop": true,
  "delay": 500
}
```

### Audio Integration

Audio integrates seamlessly with element interactions:

```javascript
{
  id: 'button',
  type: 'sprite',
  // ... other properties
  hover: {
    soundSrc: 'file:hover-sound'  // Plays on hover
  },
  click: {
    soundSrc: 'file:click-sound'  // Plays on click
  }
}
```

## 🎬 Animation System

Keyframe-based animation system for smooth transitions and effects.

### Tween Animation Plugin

**Properties:**
- `id`, `targetId`, `type`, `properties`

**Animatable Properties:**
- `alpha`, `x`, `y`, `scaleX`, `scaleY`, `rotation`

**Example:**
```json
{
  "id": "fadeSlide",
  "targetId": "myElement",
  "type": "tween",
  "properties": {
    "alpha": {
      "initialValue": 0,
      "keyframes": [
        { "duration": 500, "value": 1, "easing": "linear" },
        { "duration": 1000, "value": 0.5, "easing": "linear" }
      ]
    },
    "x": {
      "initialValue": 100,
      "keyframes": [
        { "duration": 1500, "value": 500, "easing": "linear" }
      ]
    }
  }
}
```

## 🔌 Creating Custom Plugins

The plugin system makes it easy to add new element types, animations, or audio handlers.

### Element Plugin Creation

```javascript
import { createElementPlugin } from 'route-graphics';

// Create custom element plugin
const customPlugin = createElementPlugin({
  type: "myCustomElement",
  add: ({ element, app }) => {
    // Creation logic - return a PIXI display object
    const graphics = new Graphics();
    graphics.beginFill(element.fill || 0xffffff);
    graphics.drawRect(element.x, element.y, element.width, element.height);
    graphics.endFill();
    return graphics;
  },
  update: ({ element, app, displayObject }) => {
    // Update logic - modify the display object
    if (displayObject) {
      displayObject.x = element.x;
      displayObject.y = element.y;
      displayObject.alpha = element.alpha ?? 1;
    }
  },
  delete: ({ element, app, displayObject }) => {
    // Cleanup logic
    if (displayObject) {
      displayObject.destroy();
    }
  },
  // Optional: Parse function for JSON to AST conversion
  parse: (element) => {
    // Parse JSON element to AST format
    return {
      ...element,
      parsed: true
    };
  }
});

// Register plugin in your app
await app.init({
  // ... other config
  plugins: {
    elements: [
      // ... existing plugins
      customPlugin
    ],
    animations: [/* ... */],
    audios: [/* ... */]
  }
});
```

### Animation Plugin Creation

```javascript
import { createAnimationPlugin } from 'route-graphics';

const customAnimationPlugin = createAnimationPlugin({
  type: "myCustomAnimation",
  add: ({ animation, app }) => {
    // Animation creation logic
    return {
      animation,
      startTime: Date.now(),
      active: true
    };
  },
  update: ({ animation, app, animationData }) => {
    // Animation update logic
    if (animationData.active) {
      const elapsed = Date.now() - animationData.startTime;
      if (elapsed >= animation.duration) {
        animationData.active = false;
      }
    }
  },
  delete: ({ animation, app, animationData }) => {
    // Animation cleanup logic
    // Stop any ongoing animations
  }
});
```

### Audio Plugin Creation

```javascript
import { createAudioPlugin } from 'route-graphics';

const customAudioPlugin = createAudioPlugin({
  type: "myCustomAudio",
  add: ({ audio, app }) => {
    // Audio creation logic
    return {
      audio,
      startTime: Date.now(),
      playing: true
    };
  },
  update: ({ audio, app, audioData }) => {
    // Audio update logic
    if (audioData.playing && Date.now() - audioData.startTime >= audio.delay) {
      // Start playing after delay
    }
  },
  delete: ({ audio, app, audioData }) => {
    // Audio cleanup logic
    // Stop audio playback
  }
});
```

## 🔤 Parser System

The parser system transforms your JSON input into Abstract Syntax Trees (AST) that the rendering engine can process. Each element plugin includes its own parser function that converts JSON definitions into the internal AST format.

### parseElements Function

```javascript
// Main parsing function that processes all elements
const parsedElements = parseElements({
  JSONObject: [
    {
      id: "myButton",
      type: "sprite",
      x: 100,
      y: 100,
      width: 64,
      height: 64
    }
  ],
  parserPlugins: [spritePlugin, textPlugin, ...]
});
```

### Parser Function Properties

**Parameters:**
- `state`: The raw JSON element definition from the input
- `parserPlugins`: Array of available parser plugins (useful for nested elements like containers)

**Returns:**
- AST (Abstract Syntax Tree) node with processed properties ready for rendering

### Parser Function Example

```javascript
const parseMyElement = ({ state, parserPlugins }) => {
  // Validate required properties
  if (!state.id || !state.type) {
    throw new Error('Missing required properties');
  }

  // Apply defaults and type conversion
  return {
    id: state.id,
    type: state.type,
    x: Math.round(state.x ?? 0),
    y: Math.round(state.y ?? 0),
    width: Math.round(state.width ?? 100),
    height: Math.round(state.height ?? 50),
    // Custom property with default
    customProperty: state.customProperty ?? "default",
    // Example: Hex color to number conversion
    color: state.color ? parseInt(state.color.replace('#', ''), 16) : 0x000000,
  };
};
```

## 📁 Asset Management

Route Graphics uses a sophisticated asset management system with aliasing.

### Asset Management

#### Loading Assets

Load assets using the `createAssetBufferManager`:

```javascript
import { createAssetBufferManager } from 'route-graphics';

// Define assets with URL and type
const assets = {
  "hero-sprite": {
    url: "./assets/hero.png",
    type: "image/png",
  },
  "background-image": {
    url: "./assets/background.jpg",
    type: "image/jpeg"
  },
  "bg-music": {
    url: "./audio/background.mp3",
    type: "audio/mpeg",
  },
  "click-sound": {
    url: "./audio/click.wav",
    type: "audio/wav"
  }
};

// Load assets using asset buffer manager
const assetBufferManager = createAssetBufferManager();
await assetBufferManager.load(assets);
const assetBufferMap = assetBufferManager.getBufferMap();

// Load assets into the app
await app.loadAssets(assetBufferMap);
```

#### Asset Aliases

Once loaded, assets are referenced by their alias keys:

```json
{
  "id": "hero",
  "type": "sprite",
  "src": "hero-sprite"
}
```

#### Supported Asset Types

- **Images**: PNG, JPG, JPEG, WebP, GIF
- **Audio**: MP3, WAV, OGG
- **Fonts**: TTF, OTF, WOFF

## 🧪 Development & Testing

### Running Tests

```bash
# Run all tests
npx vitest

# Run specific test file
npx vitest path/to/test.test.js
```
### Code Quality

```bash
# Build visual tests
bun run vt:generate


# Fix linting issues
bun run lint:fix

```

## 🎯 Complete JSON Example

```json
{
  "elements": [
    {
      "id": "background",
      "type": "sprite",
      "x": 0,
      "y": 0,
      "width": 1920,
      "height": 1080,
      "src": "file:bg-image"
    },
    {
      "id": "title",
      "type": "text",
      "x": 960,
      "y": 100,
      "content": "Game Title",
      "textStyle": {
        "fill": "#ffffff",
        "fontFamily": "Arial",
        "fontSize": 64,
        "align": "center"
      }
    },
    {
      "id": "buttonContainer",
      "type": "container",
      "x": 960,
      "y": 400,
      "width": 200,
      "height": 300,
      "direction": "vertical",
      "gap": 20,
      "children": [
        {
          "id": "startBtn",
          "type": "sprite",
          "x": 0,
          "y": 0,
          "width": 200,
          "height": 50,
          "src": "file:btn-normal",
          "hover": {
            "imageSrc": "file:btn-hover",
            "soundSrc": "file:hover-sound"
          },
          "click": {
            "action": "startGame",
            "soundSrc": "file:click-sound"
          }
        }
      ]
    }
  ],
  "animations": [
    {
      "id": "titleFadeIn",
      "targetId": "title",
      "type": "tween",
      "properties": {
        "alpha": {
          "initialValue": 0,
          "keyframes": [
            { "duration": 2000, "value": 1, "easing": "linear" }
          ]
        }
      }
    }
  ],
  "audio": [
    {
      "id": "bgMusic",
      "type": "sound",
      "src": "file:background-music",
      "volume": 600,
      "loop": true
    }
  ]
}
```


## 📚 Schemas

All element types are defined with YAML schemas in the `src/schemas/` directory, providing:

- Type definitions and validation
- Property documentation
- Default values
- Required field specifications

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

---

**Route Graphics** - Build interactive 2D interfaces with the power of JSON and WebGL.


