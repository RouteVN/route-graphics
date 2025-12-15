# Event Handling Patterns for Route Graphics

This document explores various patterns for implementing event handling in the Route Graphics project, with concrete examples for right-click and other events.

## 1. Functional Approach with Higher-Order Functions

### Basic Example
```javascript
// Higher-order function that creates event handlers
const createEventHandler = (eventType) => (element, eventData, eventHandler, app) => {
  const { soundSrc, actionPayload } = eventData;

  return () => {
    if (actionPayload && eventHandler) {
      eventHandler(eventType, {
        _event: { id: element.label },
        ...actionPayload,
      });
    }

    if (soundSrc && app?.audioStage) {
      app.audioStage.add({
        id: `${eventType}-${element.label}-${Date.now()}`,
        url: soundSrc,
        loop: false,
      });
    }
  };
};

// Specialized handlers for complex events
const createHoverHandler = () => (element, eventData, eventHandler, app) => {
  const { cursor, soundSrc, actionPayload } = eventData;

  const overListener = () => {
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

  const outListener = () => {
    element.cursor = "auto";
  };

  element.on("pointerover", overListener);
  element.on("pointerout", outListener);

  return { overListener, outListener };
};

// Composition function to add multiple events
const withEvents = (element, events, eventHandler, app) => {
  const eventCreators = {
    click: createEventHandler('click'),
    rightClick: createEventHandler('rightclick'),
    hover: createHoverHandler(),
    scrollUp: createEventHandler('scrollup'),
    scrollDown: createEventHandler('scrolldown'),
  };

  const cleanup = [];

  Object.entries(events).forEach(([eventType, eventData]) => {
    if (eventData && eventCreators[eventType]) {
      if (eventType === 'hover') {
        const handlers = eventCreators[eventType](element, eventData, eventHandler, app);
        cleanup.push(() => {
          element.off("pointerover", handlers.overListener);
          element.off("pointerout", handlers.outListener);
        });
      } else if (eventType === 'rightClick') {
        const handler = eventCreators[eventType](element, eventData, eventHandler, app);
        element.on("rightclick", handler);
        cleanup.push(() => element.off("rightclick", handler));
      } else if (eventType === 'scroll') {
        // Handle nested scroll structure
        const scrollUpHandler = createEventHandler('scrollup')(element, eventData.up, eventHandler, app);
        const scrollDownHandler = createEventHandler('scrolldown')(element, eventData.down, eventHandler, app);

        const wheelHandler = (e) => {
          if (e.deltaY < 0 && eventData.up) scrollUpHandler();
          else if (e.deltaY > 0 && eventData.down) scrollDownHandler();
        };

        element.on("wheel", wheelHandler);
        cleanup.push(() => element.off("wheel", wheelHandler));
      } else {
        const handler = eventCreators[eventType](element, eventData, eventHandler, app);
        element.on("pointerup", handler);
        cleanup.push(() => element.off("pointerup", handler));
      }
    }
  });

  // Return cleanup function
  element._cleanupEvents = () => {
    cleanup.forEach(fn => fn());
    element._cleanupEvents = null;
  };

  return element;
};

// Usage in addRect
export const addRect = ({ app, element, eventHandler }) => {
  const rect = new Graphics();
  rect.label = element.id;

  // Draw rect...

  const events = {
    click: element.click,
    rightClick: element.rightClick,
    hover: element.hover,
    scroll: element.scroll,
  };

  withEvents(rect, events, eventHandler, app);

  parent.addChild(rect);

  // Cleanup on signal abort
  signal.addEventListener("abort", () => {
    if (rect._cleanupEvents) rect._cleanupEvents();
  });
};
```

### Advanced Functional Example with Currying
```javascript
// Curried event creator for more flexibility
const createEventCreator = (app) => (eventType) => (eventData) => (element) => (eventHandler) => {
  const { soundSrc, actionPayload } = eventData;

  return () => {
    if (actionPayload && eventHandler) {
      eventHandler(eventType, {
        _event: { id: element.label },
        ...actionPayload,
      });
    }

    if (soundSrc && app?.audioStage) {
      app.audioStage.add({
        id: `${eventType}-${element.label}-${Date.now()}`,
        url: soundSrc,
        loop: false,
      });
    }
  };
};

// Usage
const createRectEvent = createEventCreator(app);
const clickEventCreator = createRectEvent('click');
const rectClickHandler = clickEventHandler(clickEventData)(rect)(eventHandler);
```

## 2. Event Bus/Pub-Sub Pattern

### Simple Event Bus
```javascript
// Create event bus factory
const createEventBus = () => {
  const events = new Map();
  const onceEvents = new Map();

  return {
    on: (eventName, callback) => {
      if (!events.has(eventName)) {
        events.set(eventName, []);
      }
      events.get(eventName).push(callback);

      // Return unsubscribe function
      return () => {
        const callbacks = events.get(eventName);
        if (callbacks) {
          const index = callbacks.indexOf(callback);
          if (index > -1) {
            callbacks.splice(index, 1);
          }
        }
      };
    },

    once: (eventName, callback) => {
      if (!onceEvents.has(eventName)) {
        onceEvents.set(eventName, []);
      }
      onceEvents.get(eventName).push(callback);
    },

    emit: (eventName, data) => {
      // Handle regular listeners
      const callbacks = events.get(eventName);
      if (callbacks) {
        callbacks.forEach(callback => callback(data));
      }

      // Handle once listeners
      const onceCallbacks = onceEvents.get(eventName);
      if (onceCallbacks) {
        onceCallbacks.forEach(callback => callback(data));
        onceEvents.delete(eventName);
      }
    },

    off: (eventName) => {
      events.delete(eventName);
      onceEvents.delete(eventName);
    },

    clear: () => {
      events.clear();
      onceEvents.clear();
    }
  };
};

// Create global event bus
const eventBus = createEventBus();

// Event types
const EVENT_TYPES = {
  ELEMENT_CLICK: 'element:click',
  ELEMENT_RIGHT_CLICK: 'element:rightclick',
  ELEMENT_HOVER: 'element:hover',
  ELEMENT_SCROLL: 'element:scroll',
  ELEMENT_KEYBOARD: 'element:keyboard',
  ELEMENT_DRAG: 'element:drag',
};

// Element emits events to the bus
if (clickEvents) {
  rect.on("pointerup", () => {
    eventBus.emit(EVENT_TYPES.ELEMENT_CLICK, {
      elementId: rect.label,
      elementType: 'rect',
      soundSrc: clickEvents.soundSrc,
      actionPayload: clickEvents.actionPayload,
      timestamp: Date.now(),
    });
  });
}

if (rightClickEvents) {
  rect.on("rightclick", () => {
    eventBus.emit(EVENT_TYPES.ELEMENT_RIGHT_CLICK, {
      elementId: rect.label,
      elementType: 'rect',
      soundSrc: rightClickEvents.soundSrc,
      actionPayload: rightClickEvents.actionPayload,
      timestamp: Date.now(),
    });
  });
}

// Main app or services subscribe to events
const setupEventSubscriptions = (app, eventHandler) => {
  const subscriptions = [];

  // Subscribe to clicks
  subscriptions.push(
    eventBus.on(EVENT_TYPES.ELEMENT_CLICK, (data) => {
      console.log(`Click on ${data.elementType} ${data.elementId}`);

      if (data.actionPayload && eventHandler) {
        eventHandler('click', {
          _event: { id: data.elementId },
          ...data.actionPayload,
        });
      }

      if (data.soundSrc && app.audioStage) {
        app.audioStage.add({
          id: `click-${data.elementId}-${Date.now()}`,
          url: data.soundSrc,
          loop: false,
        });
      }
    })
  );

  // Subscribe to right-clicks
  subscriptions.push(
    eventBus.on(EVENT_TYPES.ELEMENT_RIGHT_CLICK, (data) => {
      console.log(`Right-click on ${data.elementType} ${data.elementId}`);

      if (data.actionPayload && eventHandler) {
        eventHandler('rightclick', {
          _event: { id: data.elementId },
          ...data.actionPayload,
        });
      }

      if (data.soundSrc && app.audioStage) {
        app.audioStage.add({
          id: `rightclick-${data.elementId}-${Date.now()}`,
          url: data.soundSrc,
          loop: false,
        });
      }
    })
  );

  // Subscribe to hovers
  subscriptions.push(
    eventBus.on(EVENT_TYPES.ELEMENT_HOVER, (data) => {
      console.log(`Hover on ${data.elementType} ${data.elementId}`);
      // Handle hover...
    })
  );

  // Subscribe to scroll events
  subscriptions.push(
    eventBus.on(EVENT_TYPES.ELEMENT_SCROLL, (data) => {
      console.log(`${data.direction} scroll on ${data.elementType} ${data.elementId}`);
      // Handle scroll...
    })
  );

  // Return cleanup function
  return () => {
    subscriptions.forEach(unsubscribe => unsubscribe());
  };
};

// For cleanup, store unsubscribe functions
rect._eventUnsubscribers = [];
```

### Advanced Event Bus with Namespaces
```javascript
// Create namespaced event bus factory
const createNamespacedEventBus = () => {
  const namespaces = new Map();

  return {
    namespace: (name) => {
      if (!namespaces.has(name)) {
        namespaces.set(name, createEventBus());
      }
      return namespaces.get(name);
    },

    emitToNamespace: (namespaceName, eventName, data) => {
      const ns = namespaces.get(namespaceName);
      if (ns) {
        ns.emit(eventName, data);
      }
    },

    broadcast: (eventName, data) => {
      namespaces.forEach(ns => ns.emit(eventName, data));
    }
  };
};

// Usage
const eventBus = createNamespacedEventBus();
const rectEvents = eventBus.namespace('rect');
const spriteEvents = eventBus.namespace('sprite');
const audioEvents = eventBus.namespace('audio');

// Audio service subscribes to all click events for sound
eventBus.broadcast('element:any:click', (data) => {
  if (data.soundSrc) {
    playSound(data.soundSrc);
  }
});
```

## 3. Strategy Pattern for Event Types

```javascript
// Create event strategy factory
const createEventStrategy = (setup, cleanup) => ({
  setup,
  cleanup
});

// Event strategies
const eventStrategies = {
  click: createEventStrategy(
    (element, eventData, eventHandler, app) => {
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

      element.on("pointerup", handler);
      element._clickHandler = handler;
    },
    (element) => {
      if (element._clickHandler) {
        element.off("pointerup", element._clickHandler);
        delete element._clickHandler;
      }
    }
  ),

  rightClick: createEventStrategy(
    (element, eventData, eventHandler, app) => {
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

      element.on("rightclick", handler);
      element._rightClickHandler = handler;
    },
    (element) => {
      if (element._rightClickHandler) {
        element.off("rightclick", element._rightClickHandler);
        delete element._rightClickHandler;
      }
    }
  ),

  scroll: createEventStrategy(
    (element, eventData, eventHandler, app) => {
      const handlers = {};

      if (eventData.up) {
        handlers.up = () => {
          if (eventData.up.actionPayload && eventHandler) {
            eventHandler('scrollup', {
              _event: { id: element.label },
              ...eventData.up.actionPayload,
            });
          }
        };
      }

      if (eventData.down) {
        handlers.down = () => {
          if (eventData.down.actionPayload && eventHandler) {
            eventHandler('scrolldown', {
              _event: { id: element.label },
              ...eventData.down.actionPayload,
            });
          }
        };
      }

      const wheelHandler = (e) => {
        if (e.deltaY < 0 && handlers.up) handlers.up();
        else if (e.deltaY > 0 && handlers.down) handlers.down();
      };

      element.on("wheel", wheelHandler);
      element._wheelHandler = wheelHandler;
      element._scrollHandlers = handlers;
    },
    (element) => {
      if (element._wheelHandler) {
        element.off("wheel", element._wheelHandler);
        delete element._wheelHandler;
        delete element._scrollHandlers;
      }
    }
  )
};

// Event strategy registry
const eventStrategyRegistry = {
  strategies: eventStrategies,

  register: (type, strategy) => {
    strategies[type] = strategy;
  },

  get: (type) => {
    return strategies[type];
  }
};

// Usage
export const addRect = ({ app, element, eventHandler }) => {
  const rect = new Graphics();
  rect.label = element.id;

  // Draw rect...

  // Apply strategies for each event type
  Object.keys(element).forEach(eventType => {
    const eventData = element[eventType];
    const strategy = eventStrategyRegistry.get(eventType);

    if (eventData && strategy) {
      strategy.setup(rect, eventData, eventHandler, app);
    }
  });

  // Store cleanup function
  rect._cleanupAllEvents = () => {
    Object.keys(element).forEach(eventType => {
      const eventData = element[eventType];
      const strategy = eventStrategyRegistry.get(eventType);

      if (eventData && strategy) {
        strategy.cleanup(rect);
      }
    });
  };

  parent.addChild(rect);
};
```

## 4. Command Pattern for Actions

```javascript
// Create command factory
const createCommand = (execute) => ({ execute });

// Concrete commands
const createTriggerEventCommand = (eventType, actionPayload) =>
  createCommand((context) => {
    const { eventHandler, elementId } = context;
    if (eventHandler) {
      eventHandler(eventType, {
        _event: { id: elementId },
        ...actionPayload,
      });
    }
  });

const createPlaySoundCommand = (soundSrc) =>
  createCommand((context) => {
    const { app, elementId } = context;
    if (soundSrc && app?.audioStage) {
      app.audioStage.add({
        id: `${soundSrc}-${elementId}-${Date.now()}`,
        url: soundSrc,
        loop: false,
      });
    }
  });

const createCompositeCommand = (commands = []) => ({
  commands,
  addCommand: (command) => {
    commands.push(command);
  },
  execute: (context) => {
    commands.forEach(command => command.execute(context));
  }
});

// Command factory
const commandFactory = {
  createFromEventData: (eventData) => {
    const commands = [];

    if (eventData.actionPayload) {
      commands.push(createTriggerEventCommand('click', eventData.actionPayload));
    }

    if (eventData.soundSrc) {
      commands.push(createPlaySoundCommand(eventData.soundSrc));
    }

    return createCompositeCommand(commands);
  }
};

// Usage
if (clickEvents) {
  const command = commandFactory.createFromEventData(clickEvents);

  rect.on("pointerup", () => {
    command.execute({
      eventHandler,
      app,
      elementId: rect.label
    });
  });
}
```

## 5. Mixin Pattern for Event Capabilities

```javascript
// Create event capabilities mixin
const createEventCapabilities = () => {
  const capabilities = {
    // Add event handling capabilities to an element
    applyTo: (element) => {
      element.eventHandlers = new Map();
      element.cleanupFunctions = [];

      // Method to add an event
      element.addEvent = (eventType, eventData, eventHandler, app) => {
        const handler = element.createEventHandler(eventType, eventData, eventHandler, app);

        // Store handler for cleanup
        element.eventHandlers.set(eventType, handler);

        // Add PIXI listener
        const pixiEvent = element.getPixiEventName(eventType);
        element.on(pixiEvent, handler);

        // Store cleanup function
        element.cleanupFunctions.push(() => {
          element.off(pixiEvent, handler);
        });
      };

      // Create appropriate event handler
      element.createEventHandler = (eventType, eventData, eventHandler, app) => {
        const { soundSrc, actionPayload } = eventData;

        return () => {
          if (actionPayload && eventHandler) {
            eventHandler(eventType, {
              _event: { id: element.label },
              ...actionPayload,
            });
          }

          if (soundSrc && app?.audioStage) {
            app.audioStage.add({
              id: `${eventType}-${element.label}-${Date.now()}`,
              url: soundSrc,
              loop: false,
            });
          }
        };
      };

      // Map event types to PIXI event names
      element.getPixiEventName = (eventType) => {
        const eventMap = {
          'click': 'pointerup',
          'rightClick': 'rightclick',
          'hover': 'pointerover',
        };
        return eventMap[eventType] || eventType;
      };

      // Cleanup all events
      element.cleanupEvents = () => {
        element.cleanupFunctions.forEach(cleanup => cleanup());
        element.eventHandlers.clear();
        element.cleanupFunctions = [];
      };

      return element;
    }
  };

  return capabilities;
};

// Usage
export const addRect = ({ app, element, eventHandler }) => {
  const rect = new Graphics();
  rect.label = element.id;

  // Apply event capabilities mixin
  const eventCapabilities = createEventCapabilities();
  eventCapabilities.applyTo(rect);

  // Add events using the mixin
  if (element.click) {
    rect.addEvent('click', element.click, eventHandler, app);
  }

  if (element.rightClick) {
    rect.addEvent('rightClick', element.rightClick, eventHandler, app);
  }

  // Draw rect...
  parent.addChild(rect);

  // Cleanup on signal abort
  signal.addEventListener("abort", () => {
    rect.cleanupEvents();
  });
};
```

## 6. Observer Pattern with Typed Events

```javascript
// Create typed event emitter
const createTypedEventEmitter = () => {
  const listeners = new Map();

  return {
    // Type-safe event subscription
    on: (eventType, listener) => {
      if (!listeners.has(eventType)) {
        listeners.set(eventType, new Set());
      }
      listeners.get(eventType).add(listener);

      // Return unsubscribe function
      return () => {
        listeners.get(eventType)?.delete(listener);
      };
    },

    // Emit typed event
    emit: (eventType, event) => {
      const eventListeners = listeners.get(eventType);
      if (eventListeners) {
        eventListeners.forEach(listener => {
          try {
            listener(event);
          } catch (error) {
            console.error(`Error in event listener for ${eventType}:`, error);
          }
        });
      }
    },

    // Once-only listener
    once: (eventType, listener) => {
      const onceWrapper = (event) => {
        listener(event);
        this.off(eventType, onceWrapper);
      };
      return this.on(eventType, onceWrapper);
    },

    off: (eventType, listener) => {
      listeners.get(eventType)?.delete(listener);
    },

    clear: () => {
      listeners.clear();
    }
  };
};

// Create event factory
const createElementEvent = (type, elementId, timestamp = Date.now()) => ({
  type,
  elementId,
  timestamp
});

const createClickEvent = (elementId, actionPayload) => ({
  ...createElementEvent('click', elementId),
  actionPayload
});

const createRightClickEvent = (elementId, actionPayload) => ({
  ...createElementEvent('rightclick', elementId),
  actionPayload
});

const createHoverEvent = (elementId, actionPayload, isEntering) => ({
  ...createElementEvent('hover', elementId),
  actionPayload,
  isEntering
});

// Create event processor
const createElementEventProcessor = (eventEmitter, app) => {
  let currentEventHandler = null;

  const setupSubscriptions = () => {
    eventEmitter.on('click', (event) => {
      console.log(`Processing click on ${event.elementId}`);

      // Trigger user handler
      if (event.actionPayload && currentEventHandler) {
        currentEventHandler('click', {
          _event: { id: event.elementId },
          ...event.actionPayload,
        });
      }
    });

    eventEmitter.on('rightclick', (event) => {
      console.log(`Processing right-click on ${event.elementId}`);

      if (event.actionPayload && currentEventHandler) {
        currentEventHandler('rightclick', {
          _event: { id: event.elementId },
          ...event.actionPayload,
        });
      }
    });

    eventEmitter.on('hover', (event) => {
      console.log(`${event.isEntering ? 'Entering' : 'Leaving'} ${event.elementId}`);
      // Handle hover logic...
    });
  };

  setupSubscriptions();

  return {
    setEventHandler: (handler) => {
      currentEventHandler = handler;
    }
  };
};

// Usage in element
const eventEmitter = createTypedEventEmitter();
const eventProcessor = createElementEventProcessor(eventEmitter, app);

// Element emits typed events
if (clickEvents) {
  rect.on("pointerup", () => {
    eventEmitter.emit('click', createClickEvent(rect.label, clickEvents.actionPayload));
  });
}
```

## 7. State Machine for Complex Interactions

```javascript
// Create interaction state machine
const createInteractionStateMachine = (initialState = 'idle') => {
  let state = initialState;
  const transitions = new Map();
  const handlers = new Map();

  return {
    // Define state transitions
    addTransition: (fromState, event, toState) => {
      if (!transitions.has(fromState)) {
        transitions.set(fromState, new Map());
      }
      transitions.get(fromState).set(event, toState);
    },

    // Add handler for state transition
    addHandler: (fromState, event, handler) => {
      const key = `${fromState}:${event}`;
      handlers.set(key, handler);
    },

    // Process event
    process: (event, context) => {
      const currentTransitions = transitions.get(state);
      if (currentTransitions && currentTransitions.has(event)) {
        const nextState = currentTransitions.get(event);
        const key = `${state}:${event}`;
        const handler = handlers.get(key);

        if (handler) {
          handler(context);
        }

        state = nextState;
        return true;
      }
      return false;
    },

    reset: () => {
      state = 'idle';
    },

    getState: () => state
  };
};

// Create interaction state machine for rect elements
const createRectInteractionMachine = (element, eventHandler, app) => {
  const machine = createInteractionStateMachine();

  // Define states and transitions
  machine.addTransition('idle', 'pointerdown', 'pressed');
  machine.addTransition('pressed', 'pointerup', 'idle');
  machine.addTransition('pressed', 'pointerupoutside', 'idle');
  machine.addTransition('idle', 'rightdown', 'rightPressed');
  machine.addTransition('rightPressed', 'rightup', 'idle');
  machine.addTransition('idle', 'pointerover', 'hovering');
  machine.addTransition('hovering', 'pointerout', 'idle');

  // Add handlers
  machine.addHandler('idle', 'rightdown', () => {
    if (element.rightClickEvents) {
      const { soundSrc, actionPayload } = element.rightClickEvents;

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
    }
  });

  machine.addHandler('idle', 'pointerdown', () => {
    element._isDragging = false;
    if (element.dragEvents?.start) {
      // Handle drag start
    }
  });

  machine.addHandler('hovering', 'pointerout', () => {
    element.cursor = "auto";
  });

  machine.addHandler('idle', 'pointerover', () => {
    if (element.hoverEvents) {
      const { cursor } = element.hoverEvents;
      if (cursor) element.cursor = cursor;
    }
  });

  return machine;
};

// Usage
export const addRect = ({ app, element, eventHandler }) => {
  const rect = new Graphics();
  rect.label = element.id;

  // Create interaction state machine
  const interactionMachine = createRectInteractionMachine(element, eventHandler, app);

  // Connect PIXI events to state machine
  rect.on('pointerdown', () => interactionMachine.process('pointerdown'));
  rect.on('pointerup', () => interactionMachine.process('pointerup'));
  rect.on('pointerupoutside', () => interactionMachine.process('pointerupoutside'));
  rect.on('rightdown', () => interactionMachine.process('rightdown'));
  rect.on('rightup', () => interactionMachine.process('rightup'));
  rect.on('pointerover', () => interactionMachine.process('pointerover'));
  rect.on('pointerout', () => interactionMachine.process('pointerout'));

  // Store machine for cleanup
  rect._interactionMachine = interactionMachine;

  // Draw rect...
  parent.addChild(rect);
};
```

## 8. Reactive Programming with Observables

```javascript
// Create observable factory
const createObservable = (subscribe) => ({
  subscribe,

  // Create observable from PIXI event
  staticFromEvent: (element, eventName) =>
    createObservable((observer) => {
      const handler = (event) => observer.next(event);
      element.on(eventName, handler);

      // Return unsubscribe function
      return () => element.off(eventName, handler);
    }),

  // Map observable values
  map: (fn) =>
    createObservable((observer) => {
      return subscribe({
        next: (value) => observer.next(fn(value)),
        error: (error) => observer.error(error),
        complete: () => observer.complete(),
      });
    }),

  // Filter observable values
  filter: (predicate) =>
    createObservable((observer) => {
      return subscribe({
        next: (value) => {
          if (predicate(value)) {
            observer.next(value);
          }
        },
        error: (error) => observer.error(error),
        complete: () => observer.complete(),
      });
    })
});

// Reactive event handling
export const addRect = ({ app, element, eventHandler }) => {
  const rect = new Graphics();
  rect.label = element.id;

  // Create observables for events
  const click$ = createObservable.staticFromEvent(rect, 'pointerup');
  const rightClick$ = createObservable.staticFromEvent(rect, 'rightclick');
  const hover$ = createObservable.staticFromEvent(rect, 'pointerover');
  const unhover$ = createObservable.staticFromEvent(rect, 'pointerout');

  // Process clicks
  const clickSubscription = click$
    .filter(() => !!element.clickEvents)
    .map(() => ({
      eventType: 'click',
      elementId: rect.label,
      eventData: element.clickEvents,
    }))
    .subscribe(({ eventType, elementId, eventData }) => {
      const { soundSrc, actionPayload } = eventData;

      if (actionPayload && eventHandler) {
        eventHandler(eventType, {
          _event: { id: elementId },
          ...actionPayload,
        });
      }

      if (soundSrc && app?.audioStage) {
        app.audioStage.add({
          id: `${eventType}-${elementId}-${Date.now()}`,
          url: soundSrc,
          loop: false,
        });
      }
    });

  // Process right-clicks
  const rightClickSubscription = rightClick$
    .filter(() => !!element.rightClickEvents)
    .map(() => ({
      eventType: 'rightclick',
      elementId: rect.label,
      eventData: element.rightClickEvents,
    }))
    .subscribe(({ eventType, elementId, eventData }) => {
      const { soundSrc, actionPayload } = eventData;

      if (actionPayload && eventHandler) {
        eventHandler(eventType, {
          _event: { id: elementId },
          ...actionPayload,
        });
      }

      if (soundSrc && app?.audioStage) {
        app.audioStage.add({
          id: `${eventType}-${elementId}-${Date.now()}`,
          url: soundSrc,
          loop: false,
        });
      }
    });

  // Process hover
  const hoverSubscription = hover$
    .filter(() => !!element.hoverEvents)
    .subscribe(() => {
      const { cursor, soundSrc, actionPayload } = element.hoverEvents;

      if (cursor) rect.cursor = cursor;

      if (actionPayload && eventHandler) {
        eventHandler('hover', {
          _event: { id: rect.label },
          ...actionPayload,
        });
      }

      if (soundSrc && app?.audioStage) {
        app.audioStage.add({
          id: `hover-${rect.label}-${Date.now()}`,
          url: soundSrc,
          loop: false,
        });
      }
    });

  const unhoverSubscription = unhover$.subscribe(() => {
    rect.cursor = "auto";
  });

  // Store subscriptions for cleanup
  rect._subscriptions = [
    clickSubscription,
    rightClickSubscription,
    hoverSubscription,
    unhoverSubscription,
  ];

  // Cleanup function
  rect._cleanupReactive = () => {
    rect._subscriptions.forEach(unsubscribe => unsubscribe());
    rect._subscriptions = [];
  };

  // Draw rect...
  parent.addChild(rect);

  // Cleanup on signal abort
  signal.addEventListener("abort", () => {
    rect._cleanupReactive();
  });
};
```

## Summary

Each pattern has its strengths:

- **Higher-Order Functions**: Great for code reuse and composability
- **Event Bus**: Excellent for decoupling components
- **Strategy Pattern**: Perfect when you have many different event types with different behaviors
- **Command Pattern**: Useful when you need to queue, undo, or batch actions
- **Mixin Pattern**: Clean way to add capabilities to objects
- **Observer Pattern**: Type-safe and flexible event system
- **State Machine**: Best for complex interaction flows
- **Reactive Programming**: Powerful for event composition and transformation

Choose the pattern that best fits your project's complexity and team's preferences. For Route Graphics, a combination of Event Bus for global events and Higher-Order Functions for element-specific events might work well.