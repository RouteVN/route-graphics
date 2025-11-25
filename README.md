# Route Graphics

A 2D graphics rendering interface that takes JSON input and renders pixels using PixiJS.


⚠️ **Warning: This library is under active development and will have breaking changes in future versions.**

## 🚀 Overview

Route Graphics is a declarative UI system that enables developers to create rich, interactive 2D interfaces through JSON configurations. Instead of manipulating DOM elements directly, you define your interface structure using JSON, and Route Graphics handles the rendering, animations, and interactions automatically.

## 🛠️ Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/RouteVN/route-graphics.git
cd route-graphics

# Install dependencies
bun install

# Run tests
bun run test

# Build the project
bun run build
```

### Basic Usage

```javascript
import RouteGraphics, {
  SpriteRendererPlugin,
  TextRendererPlugin,
  ContainerRendererPlugin,
  TextRevealingRendererPlugin,
  GraphicsRendererPlugin,
  AudioPlugin,
  SliderRendererPlugin,
  KeyframeTransitionPlugin,
  createAssetBufferManager,
} from 'route-graphics';

// Load assets
const assets = {
  "file:bg1": {
    url: "/public/slider-bar.png",
    type: "image/png",
  },
  "file:circle-red": {
    url: "/public/circle-red.png",
    type: "image/png",
  },
  "file:bgm-1": {
    url: "/public/bgm-1.mp3",
    type: "audio/mpeg",
  },
};

const assetBufferManager = createAssetBufferManager();
await assetBufferManager.load(assets);
const assetBufferMap = assetBufferManager.getBufferMap();

// Initialize RouteGraphics
const app = new RouteGraphics();
await app.init({
  width: 1920,
  height: 1080,
  eventHandler: (event, data) => {
    console.log('Event:', event, data);
  },
  plugins: [
    new SpriteRendererPlugin(),
    new TextRendererPlugin(),
    new ContainerRendererPlugin(),
    new TextRevealingRendererPlugin(),
    new GraphicsRendererPlugin(),
    new AudioPlugin(),
    new SliderRendererPlugin(),
    new KeyframeTransitionPlugin(),
  ],
});

// Load assets and render
await app.loadAssets(assetBufferMap);
document.body.appendChild(app.canvas);

// Render your interface
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

## 🔤 Parser System

The parser system transforms your JSON input into Abstract Syntax Trees (AST) that the rendering engine can process.

### Parser Structure

```javascript
// Main parser entry point
import parseJSONToAST from './src/parser/index.js';

const ast = parseJSONToAST(jsonElements);
```

### Supported Element Parsers

| Element | Parser Function | Description |
|---------|----------------|-------------|
| `rect` | `parseRect()` | Rectangle and shape elements |
| `sprite` | `parseSprite()` | Image-based elements |
| `text` | `parseText()` | Text elements with styling |
| `container` | `parseContainer()` | Layout containers |
| `textRevealing` | `parseTextRevealing()` | Animated text display |
| `slider` | `parseSlider()` | Interactive slider controls |

### Parser Features

- **Schema Validation**: Each element type validates against YAML schemas in `src/schemas/`

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

**Interactions:**
- `hover`: `src`, `soundSrc`, `cursor`, `actionPayload`
- `click`: `src`, `soundSrc`, `actionPayload`

**Example:**
```javascript
{
  id: 'character',
  type: 'sprite',
  x: 100,
  y: 100,
  width: 64,
  height: 64,
  src: 'file:hero-idle',
  hover: {
    src: 'file:hero-hover',
    cursor: 'pointer',
    soundSrc: 'file:hover-sound'
  },
  click: {
    src: 'file:hero-active',
    soundSrc: 'file:click-sound'
  }
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

**Interactions:**
- `hover`: `textStyle`, `cursor`, `soundSrc`, `actionPayload`
- `click`: `textStyle`, `soundSrc`, `actionPayload`

**Example:**
```javascript
{
  id: 'title',
  type: 'text',
  x: 960,
  y: 100,
  content: 'Welcome to Route Graphics',
  textStyle: {
    fill: '#ffffff',
    fontFamily: 'Arial',
    fontSize: 48,
    align: 'center'
  }
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

**Interactions:**
- `hover`: `soundSrc`, `cursor`, `actionPayload`
- `click`: `soundSrc`, `actionPayload`

**Example:**
```javascript
{
  id: 'panel',
  type: 'rect',
  x: 50,
  y: 50,
  width: 400,
  height: 300,
  fill: '0x333333',
  border: {
    width: 2,
    color: '0xffffff',
    alpha: 0.8
  },
  alpha: 0.9
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

**Layout Directions:**
- `absolute`: Manual positioning of children
- `horizontal`: Left-to-right arrangement
- `vertical`: Top-to-bottom arrangement

**Example:**
```javascript
{
  id: 'menu',
  type: 'container',
  x: 0,
  y: 0,
  width: 200,
  height: 400,
  direction: 'vertical',
  gap: 10,
  children: [
    { id: 'btn1', type: 'sprite', /* ... */ },
    { id: 'btn2', type: 'sprite', /* ... */ }
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
```javascript
content: [
  {
    text: "Hello ",
    textStyle: { fill: 'red' },  // Optional individual styling
    furigana: {                   // Optional Japanese annotations
      text: "こ",
      textStyle: { fontSize: 12 }
    }
  },
  { text: "World!" }
]
```

**Indicator Options:**
- `revealing`: `src`, `width`, `height` - indicator during animation
- `complete`: `src`, `width`, `height` - indicator when finished
- `offset`: Distance between text and indicator (default: 12)

**Example:**
```javascript
{
  id: 'story',
  type: 'textRevealing',
  x: 100,
  y: 200,
  content: [
    { text: 'Hello ', textStyle: { fill: 'red' } },
    { text: 'World!', textStyle: { fill: 'blue' } }
  ],
  speed: 50,
  revealEffect: 'typewriter'
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

**Interactions:**
- `hover`: `thumbSrc`, `barSrc`, `cursor`, `soundSrc`
- `change`: `actionPayload` - triggered during drag with current value

**Value Access:**
Use `{{ value }}` template in actionPayload to access current slider value

**Example:**
```javascript
{
  id: 'volumeSlider',
  type: 'slider',
  x: 100,
  y: 500,
  direction: 'horizontal',
  thumbSrc: 'file:slider-thumb',
  barSrc: 'file:slider-bar',
  min: 0,
  max: 100,
  step: 1,
  initialValue: 50,
  change: {
    actionPayload: {
      action: 'updateVolume',
      value: '{{ value }}'  // Current slider value
    }
  }
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
```javascript
{
  id: 'bgMusic',
  type: 'sound',
  src: 'file:bgm-level1',
  volume: 800,
  loop: true,
  delay: 500
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
```javascript
{
  id: 'fadeSlide',
  targetId: 'myElement',
  type: 'tween',
  properties: {
    alpha: {
      initialValue: 0,
      keyframes: [
        { duration: 500, value: 1, easing: 'linear' },
        { duration: 1000, value: 0.5, easing: 'linear' }
      ]
    },
    x: {
      initialValue: 100,
      keyframes: [
        { duration: 1500, value: 500, easing: 'linear' }
      ]
    }
  }
}
```

## 🎯 Event System

Route Graphics provides a comprehensive event system for handling user interactions with visual elements. Each element type supports specific events that can be configured with custom actions, sounds, and visual feedback.

### Events by Element Type

#### 🖼️ Sprite Element Events
**Supported Events:** `click`, `hover`

**Click Event Properties:**
- `src` (string, optional): Change sprite image
- `soundSrc` (string, optional): Play sound effect
- `actionPayload` (object, optional): Custom data sent to event handler

**Hover Event Properties:**
- `src` (string, optional): Change sprite image
- `soundSrc` (string, optional): Play sound effect
- `cursor` (string, optional): CSS cursor style
- `actionPayload` (object, optional): Custom data sent to event handler

#### 📝 Text Element Events
**Supported Events:** `click`, `hover`

**Click Event Properties:**
- `textStyle` (object, optional): Change text styling
- `soundSrc` (string, optional): Play sound effect
- `actionPayload` (object, optional): Custom data sent to event handler

**Hover Event Properties:**
- `textStyle` (object, optional): Change text styling
- `soundSrc` (string, optional): Play sound effect
- `cursor` (string, optional): CSS cursor style
- `actionPayload` (object, optional): Custom data sent to event handler

#### ⬜ Rectangle Element Events
**Supported Events:** `click`, `hover`

**Click Event Properties:**
- `soundSrc` (string, optional): Play sound effect
- `actionPayload` (object, optional): Custom data sent to event handler

**Hover Event Properties:**
- `soundSrc` (string, optional): Play sound effect
- `cursor` (string, optional): CSS cursor style
- `actionPayload` (object, optional): Custom data sent to event handler

#### 🎚️ Slider Element Events
**Supported Events:** `hover`, `change`

**Hover Event Properties:**
- `thumbSrc` (string, optional): Change thumb sprite image
- `barSrc` (string, optional): Change bar sprite image
- `soundSrc` (string, optional): Play sound effect
- `cursor` (string, optional): CSS cursor style

**Change Event Properties:**
- `actionPayload` (object, optional): Custom data sent to event handler

### Event Data Structure by Element Type

#### Sprite Click Event Data
```javascript
{
  _event: {
    id: 'myButton'           // ID of the clicked sprite
  },
  payload: {                  // Your configured actionPayload
    action: 'handleButtonClick',
    buttonId: 'primary'
  }
}
```

#### Sprite Hover Event Data
```javascript
{
  _event: {
    id: 'myButton'           // ID of the hovered sprite
  },
  payload: {                  // Your configured actionPayload
    action: 'handleButtonHover',
    buttonId: 'primary'
  }
}
```

#### Text Click Event Data
```javascript
{
  _event: {
    id: 'myText'             // ID of the clicked text
  },
  payload: {                  // Your configured actionPayload
    action: 'handleTextClick',
    linkId: 'home'
  }
}
```

#### Text Hover Event Data
```javascript
{
  _event: {
    id: 'myText'             // ID of the hovered text
  },
  payload: {                  // Your configured actionPayload
    action: 'handleTextHover',
    linkId: 'home'
  }
}
```

#### Rectangle Click Event Data
```javascript
{
  _event: {
    id: 'myPanel'            // ID of the clicked rectangle
  },
  payload: {                  // Your configured actionPayload
    action: 'handlePanelClick',
    panelId: 'settings'
  }
}
```

#### Rectangle Hover Event Data
```javascript
{
  _event: {
    id: 'myPanel'            // ID of the hovered rectangle
  },
  payload: {                  // Your configured actionPayload
    action: 'handlePanelHover',
    panelId: 'settings'
  }
}
```

#### Slider Hover Event Data
```javascript
{
  _event: {
    id: 'volumeSlider'       // ID of the hovered slider
  },
  payload: null              // Slider hover doesn't use payload
}
```

#### Slider Change Event Data
```javascript
{
  _event: {
    id: 'volumeSlider',      // ID of the slider element
    value: 75               // Current slider value
  },
  payload: {                  // Your configured actionPayload
    action: 'updateVolume'
  }
}
```

## 📁 Asset Management

Route Graphics uses a sophisticated asset management system with aliasing.

### Asset Aliases

Assets are referenced using the `file:` prefix:

```javascript
// Asset loading
await app.loadAssets({
  'file:hero-sprite': './assets/hero.png',
  'file:bg-music': './audio/background.mp3',
  'file:font-arial': './fonts/arial.ttf'
});

// Usage in elements
{
  id: 'hero',
  type: 'sprite',
  src: 'file:hero-sprite'  // Uses loaded asset
}
```

### Supported Asset Types

- **Images**: PNG, JPG, WebP, GIF
- **Audio**: MP3, WAV, OGG
- **Fonts**: TTF, OTF, WOFF

## 🧪 Development & Testing

### Running Tests

```bash
# Run all tests
npx vitest

# Run tests with coverage
npx vitest --coverage

# Run specific test file
npx vitest path/to/test.test.js
```
### Code Quality

```bash
# Build visual tests
bun run vt:generate

# Lint code
bun run lint

# Fix linting issues
bun run lint:fix

# Format code
bun run format
```

## 🎯 Complete JSON Example

```javascript
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

## 🔧 Extending Route Graphics

The plugin system makes it easy to add new element types:

```javascript
// Custom element plugin
const customPlugin = createElementPlugin({
  type: "customElement",
  add: ({ element, app }) => {
    // Creation logic
  },
  update: ({ element, app }) => {
    // Update logic
  },
  delete: ({ element, app }) => {
    // Delete logic
  }
});

// Register plugin
app.registerPlugin(customPlugin);
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


