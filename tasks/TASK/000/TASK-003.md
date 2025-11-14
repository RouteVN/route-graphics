---
title: make features plugins
status: todo
priority: low
---

# Description

Naming consistency:

use: `Add & Remove`  or `Create & Delete`. but don't use `Add & Delete`

---


make it so we can add and delete plugins

Benefits:

user can import only the features it uses
user can implement and bring their own element type

## Example  implementation

Example `rectPlugin.js`

```js
export const type = 'rect';

export const add = () => {
  ...
};

export const update = () => {
  ...
};

export const delete = () => {
  ...
};
```


Example `containerPlugin.js`


```js
export const type = 'container';

export const add = ({ elementPlugins, animationPlugins }) => {

  ...

  const { toAddElement, toDeleteElement, toUpdateElement } = diffElements(
    prevASTTree,
    nextASTTree,
    transitions,
  );

  for (const element of toAddElements) {
    const elementPlugins.find(elementPlugin => elementPlugin.type === element.type);

    if (!elementPlugin) {
      throw new Error('unsupported type ...')
    }

    elementPlugin.add({ ... }) // pass in all the dependencies and necessary data.
  }
};

export const update = () => {
  ...
};

export const delete = () => {
  ...
};

```


Usage: 

```js
const routeGraphics = createRouteGraphics({
  elements: [rectPlugin, spritePlugin, ...],
  animations: [tweenPlugin],
  audio: [soundPlugin]
})
```

if user don't use sound, they can just not add it.

user can create its own implementatioon for a plugin. and then easilly add it. that plugin can live outside of our repository. a plugin is a valid plugin as long a s it follow its type interface, for elements is add, update, delete.

## Example Folder structure

It should be grouped by each plugin


```
|- plugins
  |- elements
  |  |- sprite 
  |  |  |- spritePlugin.js    // I think can put all in 1 file. potentially could split into 3 files add, update, remove.
  |  |- rect
  |  |  |- rectPlugin.js
  |- animations
  |  |- tween 
  |     |- tweenPlugin.js
  |- audio 
     |- sound
        |- soundPlugins.js
```

We have 3 category types or how we should call it: `add`, `update`, `remove`


Elements, animations and audio are specifically different types.

All elements have to follow specific interface, they have add, update, remove.

All animations have different interface. 

All audio also have different interface.





the above is just a draft code. we need to:

- design the interface for plugins. propose some best ways
- once we approve the interface design, can go and implmenet it


