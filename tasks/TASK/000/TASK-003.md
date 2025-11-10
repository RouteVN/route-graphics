---
title: make features plugins
status: todo
priority: low
---

# Description

make it so we can add and remove functionality (element types).

for example

```js
const rectElement = {
  add: rectAdd,
  update: rectUpdate,
  remove: rectRemove
}
const routeGraphics = createRouteGraphics({
  ...
  elements: [rectElement, spriteElement, ...],
  animations: [...],
  audio: [...]
})
```

benefits:

user can import only the features it uses
user can implement and bring their own element type


the above is just a draft code. we need to:

- design the interface for plugins. propose some best ways
- once we approve the interface design, can go and implmenet it


