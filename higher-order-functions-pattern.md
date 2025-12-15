# Higher-Order Functions Pattern for Event Handling

This document focuses specifically on using higher-order functions to create reusable event handlers for click, hover, and right-click events.

## Click Event Handler

```javascript
// Click event handler creator
const createClickHandler = (element, eventData, eventHandler, app) => {
  const { soundSrc, actionPayload } = eventData;

  const handler = () => {
    if (actionPayload && eventHandler) {
      eventHandler('click', {
        _event: { id: element.label },
        ...actionPayload,
      });
    }

    if (soundSrc && app?.audioStage) {
      app.audioStage.add({
        id: `click-${element.label}-${Date.now()}`,
        url: soundSrc,
        loop: false,
      });
    }
  };

  element.addEventListener('pointerup', handler);

  return {
    cleanup: () => {
      element.removeEventListener('pointerup', handler);
    }
  };
};
```

## Right-Click Event Handler

```javascript
// Right-click event handler creator
const createRightClickHandler = (element, eventData, eventHandler, app) => {
  const { soundSrc, actionPayload } = eventData;

  const handler = () => {
    if (actionPayload && eventHandler) {
      eventHandler('rightclick', {
        _event: { id: element.label },
        ...actionPayload,
      });
    }

    if (soundSrc && app?.audioStage) {
      app.audioStage.add({
        id: `rightclick-${element.label}-${Date.now()}`,
        url: soundSrc,
        loop: false,
      });
    }
  };

  element.addEventListener('rightclick', handler);

  return {
    cleanup: () => {
      element.removeEventListener('rightclick', handler);
    }
  };
};
```

## Hover Event Handler

```javascript
// Hover event handler creator
const createHoverHandler = (element, eventData, eventHandler, app) => {
  const { cursor, soundSrc, actionPayload } = eventData;

  const overHandler = () => {
    if (actionPayload && eventHandler) {
      eventHandler('hover', {
        _event: { id: element.label },
        ...actionPayload,
      });
    }
    if (cursor) element.cursor = cursor;
    if (soundSrc && app?.audioStage) {
      app.audioStage.add({
        id: `hover-${element.label}-${Date.now()}`,
        url: soundSrc,
        loop: false,
      });
    }
  };

  const outHandler = () => {
    element.cursor = "auto";
  };

  // Apply listeners
  element.addEventListener("pointerover", overHandler);
  element.addEventListener("pointerout", outHandler);

  return {
    cleanup: () => {
      element.removeEventListener("pointerover", overHandler);
      element.removeEventListener("pointerout", outHandler);
      element.cursor = "auto";
    }
  };
};
```

## Combined Event System with `withEvents`

```javascript
// Master composition function that handles all event types
const withEvents = (element, events, eventHandler, app, eventHandlers = {}) => {
  const cleanupFunctions = [];

  // Apply each event using the provided handlers
  Object.entries(events).forEach(([eventType, eventData]) => {
    if (eventData && eventHandlers[eventType]) {
      const handler = eventHandlers[eventType];
      const cleanup = handler(element, eventData, eventHandler, app);

      if (cleanup) {
        if (typeof cleanup === 'function') {
          cleanupFunctions.push(cleanup);
        } else if (cleanup.cleanup) {
          cleanupFunctions.push(cleanup.cleanup);
        }
      }
    }
  });

  // Return cleanup function for all events
  return () => {
    cleanupFunctions.forEach(cleanup => cleanup());
  };
};

// Default event handlers map
const defaultEventHandlers = {
  click: createClickHandler,
  rightClick: createRightClickHandler,
  hover: createHoverHandler(),
};

// Usage in addRect
export const addRect = ({ app, element, eventHandler }) => {
  const rect = new Graphics();
  rect.label = element.id;

  // Draw rect...
  drawRect(rect, element);

  // Apply all events using default handlers
  const cleanupEvents = withEvents(rect, element, eventHandler, app, defaultEventHandlers);

  //Or use custom handlers
  // const customHandlers = {
  //   click: createClickHandler,
  //   hover: createHoverHandler(),
  //   // Add your custom handlers here
  // };
  // const cleanupEvents = withEvents(rect, element, eventHandler, app, customHandlers);

  //For update function to cleanup the events
  rect._cleanupEvents = cleanupEvents;

  parent.addChild(rect);

  return rect;
};
```

## Pros and Cons

### Pros
- Easy cleanup
- Can be reuse for update and create

### Cons
- Maybe too much cognitive load?