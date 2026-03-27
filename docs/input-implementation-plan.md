# Input Implementation Plan

Last updated: 2026-03-26

## Goal

Add text input to Route Graphics with:

- native browser text handling for IME, clipboard, mobile keyboards, and platform editing behavior
- Pixi-rendered visuals so the field can match Route Graphics styling
- a clear rollout path that starts small and avoids overbuilding v1

This plan assumes a hybrid architecture:

- DOM owns text editing state
- Pixi owns the visuals

## Review Summary

This is the best plan under the current constraints.

Why:

- keyboard-only editing is much harder and much riskier than it first appears
- a transparent native `input` or `textarea` gives us IME, copy/paste, selection semantics, and mobile keyboard behavior essentially for free
- Route Graphics already has the right extension seam through element plugins and the shared `eventHandler`

What should not be done:

- do not build a keyboard-only editor first
- do not copy `pixi/ui`'s approach of using a hidden DOM input while still treating Pixi as the text-editing source of truth
- do not use Pixi `DOMContainer` as the core strategy for this feature

Important adjustment to the earlier draft:

- v1 should be single-line only
- v1 should not try to solve multiline, nested clipping, and full custom composition rendering at the same time
- v1 should include a debug or fallback mode that can make the DOM element visible during development if needed

## Recommended Architecture

Use a new `input` element plugin with two layers:

1. A Pixi container for:
   - background
   - placeholder
   - displayed text
   - caret
   - selection highlight
   - focus ring
   - clipping mask
2. A real native `input` or `textarea` used only as the editing surface

Source of truth rules:

- DOM owns:
  - `value`
  - `selectionStart`
  - `selectionEnd`
  - focus and blur state
  - clipboard behavior
  - composition state
- Pixi owns:
  - all visible rendering
  - interaction chrome
  - caret and selection drawing
  - placeholder styling
  - focus visuals

The DOM element should be:

- attached near `app.canvas`
- positioned over the field bounds
- transparent or near-transparent
- not offscreen
- not zero-sized

That keeps IME and mobile behavior viable while still allowing full custom Pixi visuals.

## Why This Is Better Than Keyboard-Only

Keyboard-only would require Route Graphics to implement:

- IME and composition handling
- dead keys and accent composition
- mobile soft keyboard behavior
- copy, cut, and paste
- text insertion semantics
- selection movement semantics
- platform-specific editing behavior

That is a browser text editor project, not a normal feature.

A transparent native input avoids almost all of that complexity.

## Why Not Use Pixi DOMContainer

`DOMContainer` is not the best fit here.

Reasons:

- it is still marked experimental in Pixi docs
- Route Graphics container masking and scrolling are implemented in Pixi, not DOM
- DOM clipping and masked subtree behavior will still need custom handling

So the recommended approach is:

- manage one DOM root ourselves
- place and sync native inputs directly
- keep Route Graphics clipping logic explicit instead of assuming Pixi will do it for DOM nodes

## Public API Shape

Recommended initial node shape:

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
  secure: false,
  readOnly: false,
  disabled: false,
  maxLength: 80,
  inputMode: "text",
  enterKeyHint: "done",
  autofocus: false,
  textStyle: {},
  placeholderStyle: {},
  selectionStyle: {},
  caretStyle: {},
  background: {},
  padding: {
    top: 10,
    right: 12,
    bottom: 10,
    left: 12
  },
  focus: {
    cursor: "text"
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

V1 should only support single-line input.

Multiline should be added later with `multiline: true` and a real `textarea`.

## Event Contract

Recommended public events:

- `focus`
- `blur`
- `change`
- `submit`
- `selectionChange`
- `compositionStart`
- `compositionUpdate`
- `compositionEnd`

Recommended baseline payload:

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

V1 minimum:

- `focus`
- `blur`
- `change`
- `submit`

The other events can be added in phase 2.

## Rollout Strategy

## Phase 0: Design Lock

Goal:

- lock the minimal shape before writing runtime code

Decisions to finalize:

- single-line only for v1
- `input`, not `textarea`, for v1
- DOM is source of truth
- Pixi draws visuals
- shared DOM bridge service
- no `DOMContainer`

Checklist:

- [ ] finalize `input` node schema
- [ ] finalize event names and payload shape
- [ ] finalize `secure`, `readOnly`, and `disabled` semantics
- [ ] finalize whether Enter always submits in v1
- [ ] finalize external controlled value behavior

## Phase 1: Foundation

Goal:

- create the plugin and bridge infrastructure without advanced editing visuals

Files to add:

- `src/plugins/elements/input/index.js`
- `src/plugins/elements/input/parseInput.js`
- `src/plugins/elements/input/addInput.js`
- `src/plugins/elements/input/updateInput.js`
- `src/plugins/elements/input/deleteInput.js`
- `src/util/inputDomBridge.js`
- schema files under `src/schemas/elements`

Files to update:

- `src/index.js`
- `src/types.js`
- `src/RouteGraphics.js`

Checklist:

- [ ] add `InputComputedNode` types
- [ ] add raw/computed/event schemas
- [ ] add `inputPlugin` export
- [ ] add app-level DOM bridge creation
- [ ] add DOM bridge cleanup on destroy
- [ ] add parser for normalized input config

## Phase 2: V1 Usable Single-Line Input

Goal:

- ship a usable single-line field with native editing behavior

V1 scope:

- click to focus
- native typing
- IME support
- clipboard support
- password mode
- placeholder
- basic caret rendering
- `focus`, `blur`, `change`, `submit`

V1 explicitly excludes:

- multiline
- custom selection painting
- nested masked-container correctness
- advanced composition visuals

Checklist:

- [ ] render Pixi background and text
- [ ] render placeholder
- [ ] render caret
- [ ] create a native `input` per field mount
- [ ] sync DOM geometry to field bounds
- [ ] focus DOM input on pointer activation
- [ ] blur active field on outside click
- [ ] wire native `input` event to Pixi text updates
- [ ] wire native `focus` and `blur`
- [ ] wire Enter to `submit`
- [ ] support `secure`
- [ ] support `readOnly`
- [ ] support `disabled`
- [ ] support `maxLength`
- [ ] support `inputMode`
- [ ] support `enterKeyHint`
- [ ] keep DOM element transparent but positioned in place
- [ ] add debug mode to temporarily show the DOM input during development

## Phase 3: Proper Selection Sync

Goal:

- make invisible-input editing feel coherent by reflecting browser selection in Pixi

Checklist:

- [ ] sync `selectionStart` and `selectionEnd` from DOM
- [ ] render selection highlight
- [ ] update caret position from DOM selection
- [ ] hide caret when there is a range selection
- [ ] emit `selectionChange`
- [ ] handle pointer-based cursor placement
- [ ] handle pointer drag selection
- [ ] handle double-click word selection only if the behavior can match browser expectations

Notes:

- this phase is the real threshold where invisible input starts to feel complete
- do not claim full custom UI support before this phase lands

## Phase 4: Horizontal Input Scrolling

Goal:

- keep the caret and active selection visible for long text

Checklist:

- [ ] track an internal visual scroll offset
- [ ] keep caret visible after typing
- [ ] keep caret visible after arrow navigation
- [ ] keep selection edge visible when selecting
- [ ] support left, center, and right text alignment rules
- [ ] ensure password mode scrolls correctly

## Phase 5: Composition And IME Polish

Goal:

- improve composition feedback without replacing browser behavior

Checklist:

- [ ] listen to `compositionstart`
- [ ] listen to `compositionupdate`
- [ ] listen to `compositionend`
- [ ] track `composing` state
- [ ] decide whether composition text should be drawn differently in Pixi
- [ ] emit composition events if needed
- [ ] verify candidate window placement is acceptable with transparent input

Important:

- the browser still owns composition behavior
- Pixi should only mirror state, not attempt to reimplement composition logic

## Phase 6: Controlled Updates And Render Stability

Goal:

- make Route Graphics rerenders safe while a field is active

Checklist:

- [ ] preserve focus through normal `render(...)` updates
- [ ] preserve selection when external value has not changed
- [ ] sync external `value` changes into the DOM input
- [ ] avoid resetting the input element unless mode or identity changes
- [ ] define behavior when state changes conflict with ongoing composition
- [ ] verify stable behavior during animation and rerender churn

Recommended rule:

- do not overwrite DOM state during active composition unless the external render explicitly changes the field value

## Phase 7: Container, Scroll, And Clipping Correctness

Goal:

- make input fields behave correctly inside real Route Graphics layouts

This is hard enough that it should not be part of v1.

Checklist:

- [ ] compute field world bounds correctly under transforms
- [ ] recompute DOM geometry after parent movement
- [ ] support fields inside containers
- [ ] support fields inside scrolling containers
- [ ] compute visible intersection against viewport-like masks
- [ ] hide or blur the DOM input when fully clipped
- [ ] decide whether partially clipped fields should use CSS clipping, smaller bounds, or be hidden

Risk:

- Route Graphics clipping is Pixi-driven, so DOM visibility needs explicit bridge logic

## Phase 8: Multiline

Goal:

- add `textarea` support after single-line is solid

Checklist:

- [ ] add `multiline: true`
- [ ] switch to native `textarea`
- [ ] render wrapped text in Pixi
- [ ] render multiline selection rectangles
- [ ] support vertical scroll
- [ ] define Enter behavior for multiline vs submit
- [ ] support placeholder in multiline mode

Recommendation:

- do not start here

## Phase 9: Accessibility And Tab Navigation

Goal:

- make the feature usable in broader environments

Checklist:

- [ ] support `tabIndex`
- [ ] support tab navigation order
- [ ] support labels or aria metadata
- [ ] verify screen reader implications
- [ ] verify disabled and read-only semantics are native

## DOM Bridge Design

Use one app-level bridge service.

Responsibilities:

- create one DOM root near the canvas
- mount and unmount native elements
- track the active input id
- sync geometry
- sync attributes
- expose `focus`, `blur`, `destroy`

Recommended methods:

- `mount(fieldState)`
- `unmount(id)`
- `focus(id)`
- `blur(id)`
- `syncGeometry(id, rect)`
- `syncAttributes(id, attrs)`
- `syncValue(id, value)`
- `getSelection(id)`
- `destroy()`

Recommended DOM root style:

- `position: absolute`
- `top: 0`
- `left: 0`
- `pointer-events: none`

Recommended field element style:

- `position: absolute`
- `pointer-events: auto`
- `opacity: 0.001`
- `background: transparent`
- `color: transparent`
- `caret-color: transparent`
- `border: none`
- `outline: none`

Notes:

- keep a tiny non-zero opacity if browser behavior proves more stable than full zero
- avoid `display: none`, `visibility: hidden`, or offscreen positioning while focused

## State Ownership Rules

These rules should stay strict:

- DOM value is authoritative while editing
- Pixi mirrors DOM state
- Route Graphics public state is updated through events
- external renders may update the field, but must not constantly fight native editing

Recommended behavioral model:

- treat the field as semi-controlled while focused
- accept external value updates, but apply them carefully
- preserve native editing continuity whenever possible

## Testing Strategy

## Unit And Parser Tests

Checklist:

- [ ] parser normalization tests
- [ ] add/update/delete lifecycle tests
- [ ] attribute sync tests
- [ ] value sync tests
- [ ] secure mode tests
- [ ] disabled/read-only tests

## Browser Interaction Tests

Checklist:

- [ ] focus on click
- [ ] blur on outside click
- [ ] change event emission
- [ ] submit event emission
- [ ] paste behavior
- [ ] copy and cut smoke tests
- [ ] selection sync tests
- [ ] IME smoke tests

## Layout And Container Tests

Checklist:

- [ ] transformed parent positioning
- [ ] scrolled container positioning
- [ ] clipped container visibility
- [ ] rerender stability during focus

## Visual Regression Tests

Checklist:

- [ ] placeholder rendering
- [ ] caret rendering
- [ ] selection highlight rendering
- [ ] focused vs blurred state
- [ ] password mode rendering

## Risks

## Highest Risk

- clipped and scrolled containers
- preserving selection during rerenders
- matching DOM selection with Pixi text metrics
- composition visuals in fully invisible mode

## Medium Risk

- pointer-based selection
- long-text horizontal scrolling
- mobile browser quirks

## Lower Risk

- basic typing
- clipboard
- password mode
- focus and blur

## Acceptance Gates

Do not call the feature complete until all of the following are true:

- typing works with a native input
- IME works in at least one real browser smoke test
- copy and paste work
- caret position matches DOM selection
- rerenders do not drop focus unexpectedly
- password mode works
- disabled and read-only work

Do not call the feature fully customizable until these are also true:

- selection highlight is Pixi-rendered
- caret is Pixi-rendered
- placeholder is Pixi-rendered
- long text scrolling is handled
- focused editing still works with the DOM element visually hidden

## Recommendation

This is the best implementation path:

- build a hybrid transparent-input plugin
- keep v1 single-line only
- keep DOM as the editing source of truth
- keep Pixi as the visual source of truth
- postpone multiline and clipped-container correctness until after the single-line field is stable

If the team wants the fastest route to shipping, the next concrete milestone should be:

- Phase 1
- Phase 2
- a narrow slice of Phase 6 needed for rerender stability

Everything else can come after a working single-line field exists.
