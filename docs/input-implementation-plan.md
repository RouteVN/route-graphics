# Input Feature

Last updated: 2026-03-27

## Overview

Route Graphics includes a built-in `input` element for editable text fields.

The feature is designed around two goals:

- Route Graphics owns the visible UI so input fields can match the rest of the canvas-rendered interface
- the browser still provides the hard text-editing behavior that is expensive to reproduce correctly, including IME, clipboard, and mobile keyboard support

The result is a hybrid input system:

- Pixi renders the field text layer, placeholder, caret, selection highlight, and clipping
- a hidden native `input` or `textarea` is used only as the text engine

This is not a DOM-styled form control embedded in the app UI. The visible product surface is rendered by Route Graphics.

## Product Model

The `input` element behaves like a Route Graphics-native field with browser-backed editing.

Visible behavior:

- Route Graphics-rendered placeholder text
- custom text styling
- custom caret rendering
- custom selection highlight rendering
- clipping inside the input content area

Field chrome should be composed with surrounding Route Graphics elements such as `rect`, `sprite`, or `container`. The input element itself is primarily the editable text layer.

Native editing behavior:

- IME and composition
- keyboard text input
- copy, cut, and paste
- mobile soft keyboard support
- native `selectionStart` and `selectionEnd`

Pointer behavior:

- Route Graphics handles pointer focus, caret placement, and drag selection
- the hidden native control is invisible and non-clickable
- browser selection is not exposed as the visible selection surface

## Architecture

The feature is built as a normal Route Graphics element plugin.

Main parts:

- `inputPlugin` adds parsing, mounting, updating, and teardown for `type: "input"`
- a shared DOM bridge manages hidden native controls for active fields
- the Pixi runtime keeps field visuals and selection rendering in sync with the native text state

State ownership is intentionally split:

- native control owns:
  - text value
  - composition state
  - focused editing state
  - clipboard behavior
  - mobile keyboard behavior
- Route Graphics owns:
  - field visuals
  - caret placement visuals
  - selection visuals
  - pointer hit testing
  - drag selection behavior

This avoids a keyboard-only editor while also avoiding a visible DOM overlay.

## Hidden Native Control

Each mounted field uses a real browser text control:

- single-line fields use `input`
- multiline fields use `textarea`

The control is intentionally hidden from normal user interaction:

- `opacity: 0`
- transparent text
- transparent caret
- `pointer-events: none`
- no visible border or outline
- no visible browser styling

The control remains mounted in the DOM and is focused programmatically when the Route Graphics field becomes active.

Important detail:

- the native control is hidden, but it is not removed from the DOM
- this is required so IME, clipboard, and mobile keyboard behavior continue to work reliably

## Rendering

All visible input UI is drawn in Pixi.

Rendered layers:

- selection highlight
- value text
- placeholder text
- caret
- content clip mask

The input runtime also maintains internal horizontal and vertical scroll offsets so the caret and selection remain visible when content extends beyond the visible content area.

## Selection Model

Selection is visually owned by Route Graphics.

How it works:

- pointer down inside the field resolves a text index from local Pixi coordinates
- Route Graphics sets the caret or starts a range selection
- drag updates extend the selection range using Pixi hit testing
- the hidden native control is updated with `setSelectionRange(...)`
- Pixi redraws the caret and selection highlight from the current selection state

This gives the feature a canvas-native interaction model while still keeping the native control synchronized for typing, clipboard, and IME.

Selection rendering rules:

- no highlight is drawn when `selectionStart === selectionEnd`
- single-line selections draw one selection rectangle
- multiline selections draw one rectangle per covered line
- selection and caret are clipped to the content box

## Focus Model

The active field is controlled by the Route Graphics runtime.

Behavior:

- clicking or tapping a field focuses its hidden native control
- clicking outside the active field blurs it
- focus updates the caret blink state and active editing visuals
- blur hides the caret and ends active editing visuals

The field remains visually custom even while the browser owns the actual focused text control.

## Supported API

Current element shape:

```js
{
  id: "name",
  type: "input",
  x: 100,
  y: 100,
  width: 320,
  height: 44,
  value: "",
  placeholder: "Your name",
  multiline: false,
  disabled: false,
  maxLength: 80,
  textStyle: {},
  padding: {
    top: 10,
    right: 12,
    bottom: 10,
    left: 12
  },
  change: {
    payload: {}
  },
  submit: {
    payload: {}
  },
  focusEvent: {
    payload: {}
  },
  blurEvent: {
    payload: {}
  }
}
```

Intentionally omitted from the public product surface:

- password-style masking
- browser hint props such as `inputMode` and `enterKeyHint`
- debug-only visibility controls
- read-only and autofocus controls
- built-in field background and border configuration
- built-in focus ring configuration
- browser-centric tab-order configuration
- low-level composition event customization

## Events

The input element integrates with the existing Route Graphics event pipeline.

Supported events:

- `focus`
- `blur`
- `change`
- `submit`

Event payload shape:

```js
{
  _event: {
    id: "name",
    value: "abc",
    selectionStart: 1,
    selectionEnd: 3,
    composing: false
  }
}
```

Event semantics:

- `change` fires when the native value changes
- `submit` fires on Enter for single-line fields
- `submit` fires on `Ctrl+Enter` or `Cmd+Enter` for multiline fields

## Multiline Behavior

Multiline input is supported through `multiline: true`.

Behavior:

- the hidden native control switches to `textarea`
- explicit newlines are preserved
- Enter inserts a newline
- submit is moved to `Ctrl+Enter` or `Cmd+Enter`
- selection rendering spans multiple lines

The visual layer still uses Route Graphics rendering and clipping rather than browser text area chrome.

## Clipping And Containers

Input fields participate in Route Graphics layout and masking rules.

The runtime computes visible bounds from the Pixi scene graph and applies matching clipping to the hidden native control.

This allows the feature to behave correctly in cases such as:

- transformed fields
- fields inside containers
- fields inside masked or clipped parents
- partially visible fields near viewport edges

## Why This Approach Exists

This feature intentionally does not use a keyboard-only canvas editor.

That alternative would require Route Graphics to implement too much browser text behavior itself:

- IME and composition
- dead keys
- clipboard integration
- mobile keyboard behavior
- platform-specific editing semantics

It also intentionally does not use a visible DOM form field as the product UI, because that would make the field styling and interaction surface too DOM-dependent for Route Graphics.

The current architecture is the middle ground:

- browser text engine
- Route Graphics presentation and pointer interaction

## Testing

The feature is covered at three levels:

- parser and unit tests
- DOM bridge tests
- focused VT coverage for input rendering and interaction states

Primary VT cases:

- `vt/specs/input/add-input.yaml`
- `vt/specs/input/multiline-input.yaml`

Primary unit coverage includes:

- plugin lifecycle
- DOM bridge behavior
- Pixi hit testing for caret and selection
- parser normalization

## Known Limits

This feature is intentionally practical rather than a full browser text engine replacement.

Known limits:

- selection hit testing is width-based and not a complete grapheme-cluster engine
- browser accessibility behavior is only partially exposed through the hidden native control
- composition text does not currently use a distinct visual style beyond the normal synchronized field rendering
- the hidden native control is still present in the DOM because removing it would break important browser behavior

These are acceptable tradeoffs for the current product shape.

## Recommendation

Treat `input` as the standard editable text element for Route Graphics whenever custom-rendered fields are needed.

If future work expands this area, it should continue to preserve the current contract:

- Pixi remains the visible interaction surface
- the browser remains the underlying text engine
- field chrome remains composable through other Route Graphics elements instead of bloating the input API
