# TextRevealingRendererPlugin Analysis

## Overview
The TextRevealingRendererPlugin is a sophisticated text rendering system that handles:
- Multi-segment text with different styles
- Furigana annotations (ruby text)
- Text revealing animation
- Proper text wrapping and positioning
- Line-by-line animation with masking

## Core Flow

### 1. Initial Setup
```javascript
// Creates main container and text element
const container = new Container();
const newText = new Text({ text: "", style: textStyle });
container.addChild(newText);
```

### 2. Content Processing
The plugin processes content in two different modes:

#### Mode A: Single Content Item
- Uses line-by-line wrapping logic
- Processes text character by character
- Breaks text into chunks based on wordWrapWidth

#### Mode B: Multiple Content Items
- Arranges content blocks horizontally
- Handles wrapping between different styled segments
- Maintains proper spacing with furigana tracking

### 3. Text Measurement & Wrapping Algorithm

#### Key Measurement Technique
```javascript
// Calculate space width using subtraction method
const m1 = CanvasTextMetrics.measureText("a", textStyle);
const m2 = CanvasTextMetrics.measureText("a a", textStyle);
const spaceWidth = m2.width - m1.width * 2;
```

#### Wrapping Logic
```javascript
if (measurements.lineWidths[0] + x > wordWrapWidth) {
  // Wrap to next line
  x = 0;
  chunks.push({ lineParts, y });
  y += lineMaxHeight;
  lineMaxHeight = 0;
  lineParts = [];
}
```

### 4. Chunk Structure
Each chunk represents a line and contains:
```javascript
{
  lineParts: [
    {
      text: "segment text",
      style: TextStyle,
      x: horizontal_position,
      y: vertical_offset,
      align: "top|center|bottom",
      isFurigana: boolean, // for furigana parts
      parentX: number,    // for furigana positioning
      parentWidth: number // for furigana positioning
    }
  ],
  y: line_vertical_position
}
```

### 5. Furigana Handling

#### Positioning Strategy
- Furigana is positioned above parent text
- Uses parent text measurements for centering
- Added only once per segment (tracked with WeakSet)

#### Calculation
```javascript
// For single content items
y: -10, // Fixed offset above text

// For multiple content items
x: x + (measurements.lineWidths[0] - furiganaMeasurement.width) / 2,
y: 0, // Adjusted later based on parent positioning
```

### 6. Rendering Process

#### Two-Pass Rendering System
1. **First Pass**: Render regular text, store positions
2. **Second Pass**: Render furigana based on parent positions

#### Alignment Calculation
```javascript
let yOffset = part.y;
const align = part.align || "top";
if (align === "center") {
  yOffset += (maxHeight - measurements.height) / 2;
} else if (align === "bottom") {
  yOffset += maxHeight - measurements.height;
}
```

### 7. Animation System

#### Mask Creation
```javascript
// Creates gradient mask for smooth revealing
const gradient = new Graphics();
const xOffset = wordWrapWidth / 2;
const gradientWidth = wordWrapWidth / 2;
```

#### Animation Loop
- Processes chunks line by line
- Moves mask horizontally for revealing effect
- Handles indicator positioning
- Switches between revealing/complete indicators

#### Speed Control
```javascript
const speed = element.displaySpeed || 50;
const widthPerMs = speed / 1000;
mask.x += widthPerMs * timeDelta;
```

### 8. Indicator System

#### Revealing Indicator
- Positioned at the edge of revealed text
- Follows mask movement with forward offset
- Hidden when line is complete

#### Complete Indicator
- Shows when all text is revealed
- Positioned at end of last line
- Replaces revealing indicator

### 9. Performance Optimizations

#### Trailing Space Handling
```javascript
// Replace trailing spaces with non-breaking spaces
text: item.text.replace(/ +$/, (match) => "\u00A0".repeat(match.length))
```

#### Text Preservation
```javascript
// Preserve trailing spaces that might get trimmed by measureText
if (measurements.lines.length === 1 && segment.text.endsWith(" ") && !text.endsWith(" ")) {
  text += " ";
}
```

## Key Algorithms

### Space Width Calculation
1. Measure single character "a"
2. Measure "a a" (two characters with space)
3. Subtract twice the single character width
4. Result is accurate space width for current font settings

### Line Breaking Algorithm
1. Calculate remaining horizontal space
2. Measure text with constrained width
3. If text exceeds available space, wrap to next line
4. Accumulate line heights for vertical positioning
5. Track maximum line height for alignment

### Furigana Positioning Algorithm
1. Measure parent text width
2. Measure furigana text width
3. Center furigana above parent: `parentX + (parentWidth - furiganaWidth) / 2`
4. Position vertically with appropriate offset

### Animation Progression
1. Move mask horizontally at constant speed
2. When mask reaches end of line, move to next line
3. Reset mask position for new line
4. Continue until all lines processed
5. Show complete indicator when finished

## Data Flow

```
Input (content array) → Segments → Chunks → Lines → Rendered Text
                    ↓
               Furigana Processing → Position Calculation → Two-Pass Render
                    ↓
               Animation Loop → Mask Movement → Indicator Updates → Complete
```

## Key Constants & Defaults

- **Default wordWrapWidth**: 500px
- **Default displaySpeed**: 50
- **Furigana gap**: 5px
- **Forward offset**: 150px (for indicator positioning)
- **Space calculation**: Uses "a" vs "a a" method
- **Default alignment**: "top"
- **Non-breaking space**: \u00A0 for trailing spaces

## Error Handling & Edge Cases

- **Empty content**: Returns early without rendering
- **Single vs multiple items**: Different processing paths
- **Furigana tracking**: Uses WeakSet to prevent duplication
- **Trailing spaces**: Converts to non-breaking spaces
- **Text trimming**: Preserves spaces that PIXI might trim
- **Maximum height**: Prevents infinite loops with y > 10000 check

***
I think this is how it supposed to go:
You input in a bunch of text context with their own style. You put the wordWrapWidth as : container.wordWrapWidth -x 
Then you use textMetric from pixijs to get the metric and lines. After that you get the first line of the metric to insert back into your lineParts container. After that, all of the remaining text is assinged back to the chunk

Line height: you get the highest character in a line

Future feature: text showing, can pause at shome character, and can control the speed of some characters.

There is a chunks which is a collection of lines:
There is lineParts which is a collection of textObject with their own style inside a line.

So chunks->lineParts->TextObject