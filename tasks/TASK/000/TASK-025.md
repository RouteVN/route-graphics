---
title: Error during animations for nested elements
status: done
priority: high
labels:
  - bug
---

# Description

The following input gives an error

```yaml
elements:
  - id: story
    type: container
    x: 0
    'y': 0
    children:
      - id: screen
        type: container
        children:
          - id: af32
            type: rect
            fill: '#000000'
            width: 1920
            height: 1080
            click:
              actionPayload:
                actions:
                  nextLine: {}
      - id: bg-cg-alkejf3la
        type: sprite
        x: 0
        'y': 0
        src: lakjf3lka
        width: 1920
        height: 1080
animations:
  - id: bg-cg-animation-in
    type: tween
    event: add
    elementId: bg-cg-alkejf3la
    properties:
      alpha:
        initialValue: 0
        keyframes:
          - duration: 700
            value: 1
            easing: linear
```

```
Uncaught (in promise) TypeError: Cannot read properties of undefined (reading 'find')
    at Sb (RouteGraphics.js:1144:15833)
    at Object.add (RouteGraphics.js:1144:22612)
    at Object.add (RouteGraphics.js:1144:30439)
    at async Promise.all (/index 5)
    at async Mb (RouteGraphics.js:1144:32632)
    at async u (RouteGraphics.js:1628:51479)

error in t.find around the below code:
{let h=t.find(l=>l.type===a.type);if(!h)throw new Error(`No animation plugin found for type: ${a.type}`);n
```

