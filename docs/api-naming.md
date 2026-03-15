# API Naming

Public Route Graphics API names use `camelCase`.

This applies to:

- element config keys such as `rightClick`, `scrollUp`, `scrollDown`, `dragStart`, `dragMove`, and `dragEnd`
- semantic event names passed to `eventHandler(eventName, payload)`
- payload fields that describe Route Graphics event types

Native Pixi event names such as `pointerdown`, `pointerup`, `rightdown`, `rightup`, and `rightclick` are internal implementation details. They are not part of the Route Graphics public API and must not be exposed as semantic event names.
