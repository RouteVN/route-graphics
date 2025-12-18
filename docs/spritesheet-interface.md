## Sprite Sheet Approaches

### 1. JSON-Driven Sprite Sheets (Recommended for Complex Animations)

Similar to PIXI.js spritesheet loading with JSON metadata.

```yaml
sprite:
  #...

  # JSON-based sprite sheet
  spriteSheet:
    src: "" # JSON file here

    # Animation definitions
    animations:
      idle:
        frames: ["rollSequence000.png", "rollSequence001.png", "rollSequence002.png"]
        frameRate: 8
        loop: true
        playing: true
      attack:
        frames: ["attack_01.png", "attack_02.png", "attack_03.png"]
        frameRate: 12
        loop: false

    currentAnimation: "idle"
```

**JSON Metadata Format:**
```json
{
  "frames": {
    "rollSequence000.png": {
      "frame": {"x": 0, "y": 0, "w": 100, "h": 100},
      "sourceSize": {"w": 100, "h": 100}
    },
    "rollSequence001.png": {
      "frame": {"x": 100, "y": 0, "w": 100, "h": 100},
      "sourceSize": {"w": 100, "h": 100}
    }
  },
  "animations": {
    "idle": ["rollSequence000.png", "rollSequence001.png"]
  },
  "meta": {
    "image": "fighter.png"
  }
}
```

### 2. Grid-Based Sprite Sheets (Simple Approach)

Uniform grid layout where each frame has equal dimensions. Here route-graphics will automatically calculate the sprite-sheet to get the sheet position based on the provided

```yaml
sprite:
  #...

  spriteSheet:
    src: "character-sprites.png"
    width: 256        # Total sprite sheet width
    height: 192       # Total sprite sheet height
    spriteWidth: 64   # Individual sprite width
    spriteHeight: 64  # Individual sprite height

    # Animation settings
    frameIndex: 0     # Current frame (starts at 0)
    frameRate: 12     # Animation fps (optional, default: 10)
    loop: true        # Loop animation (optional, default: true)
    playing: true     # Animation playing state (optional, default: true)

    # Named frame ranges for animations
    animations:
      walk:
        startFrame: 0
        endFrame: 7
        frameRate: 12
        loop: true
      jump:
        startFrame: 8
        endFrame: 11
        frameRate: 15
        loop: false

    currentAnimation: "walk"
```

**Grid Calculations:**
- `columns = floor(spriteSheet.width / spriteSheet.spriteWidth)`
- `rows = floor(spriteSheet.height / spriteSheet.spriteHeight)`
- `totalFrames = columns * rows`
- Frame position: `x = (frameIndex % columns) * spriteWidth`, `y = floor(frameIndex / columns) * spriteHeight`

### 3. Manual Frame Definition (Maximum Control)

Define each sprite's position and size manually.

```yaml
sprite:
  id: "ui-button"
  type: sprite
  x: 100
  y: 100
  width: 80
  height: 32

  spriteSheet:
    src: "ui-elements.png"

    # Manual frame definitions
    frames:
      - name: "normal"
        x: 0
        y: 0
        width: 80
        height: 32
      - name: "hover"
        x: 80
        y: 0
        width: 80
        height: 32
      - name: "pressed"
        x: 160
        y: 0
        width: 80
        height: 32

    # Animation settings
    currentFrame: "normal"
    animations:
      hover:
        frames: ["normal", "hover"]
        frameRate: 10
        loop: true
      click:
        frames: ["pressed", "normal"]
        frameRate: 20
        loop: false
```

### 4. Hybrid Approach (Grid + Manual Override)

Combines grid-based layout with manual frame overrides for non-uniform sprites.

```yaml
sprite:
  id: "complex-character"
  type: sprite
  x: 100
  y: 100
  width: 64
  height: 64

  spriteSheet:
    src: "character-complex.png"

    # Grid settings for uniform sprites
    grid:
      width: 512
      height: 256
      spriteWidth: 64
      spriteHeight: 64

    # Manual overrides for special frames
    overrides:
      - name: "attack_frame"
        index: 12  # Override frame 12
        x: 400
        y: 64
        width: 96   # Larger than normal
        height: 64

    # Animation definitions
    animations:
      walk:
        frames: [0, 1, 2, 3, 4, 5, 6, 7]
        frameRate: 12
        loop: true
      attack:
        frames: [12]  # Uses override frame
        frameRate: 15
        loop: false
```

### JSON Approach
- **Pros**: Most efficient memory usage, optimized by PIXI.js
- **Cons**: Requires preprocessing tools, less runtime flexibility

### Grid Approach
- **Pros**: Simple to implement, predictable memory usage
- **Cons**: Wasted space if sprites vary in size

### Manual Approach
- **Pros**: Maximum flexibility, optimal packing
- **Cons**: More complex configuration, manual maintenance

### Hybrid Approach
- **Pros**: Best of both worlds, efficient for mixed sprite sizes
- **Cons**: Most complex configuration