---
title: make features plugins
status: todo
priority: low
---

# Description

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
        | - addSprite.js
        | - deleteSprite.js
        | - updateSprite.js
      | ...
      | addElements.js
  |- animations
  |  |- tween 
  |     |- tweenPlugin.js
  |- audio 
     |- sound
        |- soundPlugins.js
        | - addSound.js
        | - updateSound.js
        | - deleteSound.js
      - addAudio.js
```

We have 3 category types or how we should call it: `add`, `update`, `remove`


Elements, animations and audio are specifically different types.

All elements have same interface, all animations have same interface, all audio have same interface.
but interface of elements, animations, and audio are different.


the above is just a draft code. we need to:

- design the interface for plugins. propose some best ways
- once we approve the interface design, can go and implmenet it


It should be this flow. 
First we created the routeGraphics via createRouteGraphics and pass in all the plugins.

Then we we use the RouteGraphic to render it will pass the animation plugins and elements plugins into addElements. The addElements will use diffElements like right now to get the add/update/delete arrays. After that we will loop through the elementsPlugin to get the type and use the add/delete/update method respectively.They also passes in animationPlugin to play the animation.

The elemement plugin would probably need:

type:string
add:() //Will be mostly the same like now but add in elementsPlugin for any function container-related. And replaced the animateElements with the animationPlugin. Fix animateElements to take in animationPlugin to get the correct plugin for the animation type.