---
template: docs-documentation
title: Playground Guide
tags: documentation
sidebarId: playground-guide
---

The playground lets you edit YAML and render Route Graphics states in real time.

## Selector Behavior

- Templates are sourced from `static/public/playground/templates.yaml`.
- Selecting an item loads its `content` into the YAML editor.
- Multi-state templates enable `Previous` and `Next` navigation.

## Template Format

Single-state:

```yaml
elements:
  - id: title
    type: text
    x: 40
    y: 40
    content: "Hello"
    textStyle:
      fill: "#FFFFFF"
      fontSize: 32
```

Multi-state:

```yaml
- elements: []
- elements:
    - id: box
      type: rect
      x: 80
      y: 80
      width: 120
      height: 120
      fill: "#FFFFFF"
```

## Asset Notes

- Private aliases are preloaded in `main.js` (images/audio used by stock templates).
- Custom asset URLs are discovered from YAML and loaded automatically.
