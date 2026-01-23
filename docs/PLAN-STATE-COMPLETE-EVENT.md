# Plan: Unified Render Complete Event

## Decision: Option A (Completion Tracker)

## Problem Statement

Currently, complete events are emitted individually:
- Each animation emits its own `complete` event when finished
- Text-revealing elements emit `complete` when text is fully revealed

This requires consumers to track multiple completions. Instead, we want:
- A single `renderComplete` event when the **entire state** is done
- Fires when ALL animations AND text-revealing elements finish
- If no animations/revealing exist, fires immediately after render
- Event payload includes the **state id** for consumers to identify which state completed

## State Structure

Current state structure:
```js
{
  elements: [...],
  animations: [...],
  audio: [...]
}
```

New state structure with `id`:
```js
{
  id: "unique-state-id",  // NEW: unique identifier for this state
  elements: [...],
  animations: [...],
  audio: [...]
}
```

The `id` is:
- Unique per state
- Passed in the `renderComplete` event payload
- Allows consumers to know which state finished (useful for sequential states, tracking, etc.)

## Current Architecture

### Animation Complete (animationBus.js)
```js
const fireCompleteEvent = (context) => {
  const { id, onComplete } = context;
  emit("completed", { id });
  if (onComplete) onComplete(); // Calls eventHandler("complete", {...})
};
```

### Text-Revealing Complete (addTextRevealing.js / updateTextRevealing.js)
```js
// On each tick, checks if all characters revealed
if (allRevealed && onComplete) {
  onComplete(); // Calls eventHandler("complete", {...})
}
```

## Proposed Architecture

### Completion Tracker

Create a `StateCompletionTracker` that:
1. Stores the current state id
2. Counts pending completions at render time
3. Decrements on each individual completion
4. Fires unified `renderComplete` event with state id when count reaches 0

```js
// RouteGraphics.js
const createCompletionTracker = (eventHandler) => {
  let pendingCount = 0;
  let stateVersion = 0;
  let currentStateId = null;

  const reset = (stateId) => {
    stateVersion++;
    pendingCount = 0;
    currentStateId = stateId;
  };

  const track = (version) => {
    if (version !== stateVersion) return; // Stale
    pendingCount++;
  };

  const complete = (version) => {
    if (version !== stateVersion) return; // Stale
    pendingCount--;
    if (pendingCount === 0) {
      eventHandler?.("renderComplete", { stateId: currentStateId });
    }
  };

  const getVersion = () => stateVersion;

  const completeIfEmpty = () => {
    if (pendingCount === 0) {
      eventHandler?.("renderComplete", { stateId: currentStateId });
    }
  };

  return { reset, track, complete, getVersion, completeIfEmpty };
};
```

### Render Flow
```js
const renderInternal = (appInstance, parent, nextState, handler) => {
  // Reset tracker with the new state's id
  completionTracker.reset(nextState.id);

  applyGlobalObjects(appInstance, state.global, nextState.global);
  animationBus.cancelAll();

  renderElements({
    app: appInstance,
    parent,
    prevASTTree: state.elements,
    nextASTTree: nextState.elements,
    animations: nextState.animations,
    elementPlugins: plugins.elements,
    animationBus,
    completionTracker,  // NEW
    eventHandler: handler,
  });

  animationBus.flush();

  // ... audio, state update ...

  // If nothing to track, fire immediately
  completionTracker.completeIfEmpty();
};
```

### Animation Integration
```js
// In element plugins (addSprite.js, etc.)
const stateVersion = completionTracker.getVersion();
completionTracker.track(stateVersion);

animationBus.dispatch({
  type: "START",
  payload: {
    id: animation.id,
    element: sprite,
    properties: animation.properties,
    targetState: { x, y, alpha },
    onComplete: () => {
      completionTracker.complete(stateVersion);
    },
  },
});
```

### Text-Revealing Integration
```js
// In addTextRevealing.js
const stateVersion = completionTracker.getVersion();
completionTracker.track(stateVersion);

// In tick callback when all text revealed:
completionTracker.complete(stateVersion);
```

### Consumer Usage
```js
app.init({
  // ...
  eventHandler: (eventName, payload) => {
    if (eventName === "renderComplete") {
      console.log("Render completed:", payload.stateId);
      // Now safe to proceed to next state
    }
  }
});

app.render({
  id: "intro-scene",
  elements: [...],
  animations: [...]
});

// Later, eventHandler receives:
// eventName: "renderComplete"
// payload: { stateId: "intro-scene" }
```

## Implementation Steps

1. **Create `createCompletionTracker` factory function**
   - Add to `RouteGraphics.js` or separate file

2. **Update `RouteGraphics.js`**:
   - Create tracker in `init()`
   - Call `reset(nextState.id)` at start of `renderInternal()`
   - Pass `completionTracker` to `renderElements()`
   - Call `completeIfEmpty()` after `flush()`

3. **Update `renderElements.js`**:
   - Accept `completionTracker` parameter
   - Pass to element plugins

4. **Update element plugins with animations**:
   - Call `tracker.track()` when dispatching animation
   - Pass completion callback that calls `tracker.complete()`
   - Files: sprite, rect, text, container, video, slider, particles, animated-sprite

5. **Update text-revealing plugin**:
   - Call `tracker.track()` when starting reveal
   - Call `tracker.complete()` when fully revealed
   - Remove individual `complete` event emission

6. **Remove individual `complete` events** from animations
   - Remove `onComplete` callback that fires per-animation `complete` event
   - Keep internal completion tracking for the unified event

## Files to Modify

| File | Changes |
|------|---------|
| `src/RouteGraphics.js` | Add completionTracker, pass stateId, wire into render |
| `src/plugins/elements/renderElements.js` | Pass completionTracker to plugins |
| `src/plugins/elements/sprite/addSprite.js` | Track animation completions |
| `src/plugins/elements/sprite/updateSprite.js` | Track animation completions |
| `src/plugins/elements/rect/addRect.js` | Track animation completions |
| `src/plugins/elements/rect/updateRect.js` | Track animation completions |
| `src/plugins/elements/text/addText.js` | Track animation completions |
| `src/plugins/elements/text/updateText.js` | Track animation completions |
| `src/plugins/elements/container/addContainer.js` | Track + pass to children |
| `src/plugins/elements/container/updateContainer.js` | Track + pass to children |
| `src/plugins/elements/text-revealing/addTextRevealing.js` | Track reveal completion |
| `src/plugins/elements/text-revealing/updateTextRevealing.js` | Track reveal completion |
| `src/plugins/elements/video/*` | Track animation completions |
| `src/plugins/elements/slider/*` | Track animation completions |
| `src/plugins/elements/particles/*` | Track animation completions |
| `src/plugins/elements/animated-sprite/*` | Track animation completions |

## Edge Cases

1. **No animations or revealing**: `completeIfEmpty()` fires `renderComplete` immediately with `aborted: false`
2. **State change mid-animation**: Emits `renderComplete` with `aborted: true` for old state, then tracks new state
3. **Multiple animations on same element**: Each tracked separately, all must complete
4. **Nested containers**: Children animations tracked through recursive render
5. **State with no id**: `stateId` will be `undefined` in payload (consumers should handle)
6. **Rapid state changes**: Each interrupted state emits `aborted: true`, only final state emits `aborted: false`
7. **First render**: No abort event (no previous state to abort)

## Event Contract

```ts
// Event name
"renderComplete"

// Payload
{
  stateId: string | undefined,  // The id from the state that completed
  aborted: boolean              // true if render was interrupted by a new render
}
```

### Abort Behavior

When `render()` is called while animations are still running:
1. Emit `renderComplete` for the **previous** state with `aborted: true`
2. Start tracking the new state
3. When new state completes, emit `renderComplete` with `aborted: false`

```js
// Example: User clicks "next" before animations finish

app.render({ id: "scene-1", ... });
// Animations start...

// User clicks next before scene-1 finishes
app.render({ id: "scene-2", ... });
// → eventHandler("renderComplete", { stateId: "scene-1", aborted: true })

// Scene-2 animations complete
// → eventHandler("renderComplete", { stateId: "scene-2", aborted: false })
```

### Implementation in Completion Tracker

```js
const createCompletionTracker = (eventHandler) => {
  let pendingCount = 0;
  let stateVersion = 0;
  let currentStateId = null;

  const reset = (stateId) => {
    // If there were pending completions, the previous state was aborted
    if (pendingCount > 0 && currentStateId !== null) {
      eventHandler?.("renderComplete", { stateId: currentStateId, aborted: true });
    }

    stateVersion++;
    pendingCount = 0;
    currentStateId = stateId;
  };

  const complete = (version) => {
    if (version !== stateVersion) return; // Stale
    pendingCount--;
    if (pendingCount === 0) {
      eventHandler?.("renderComplete", { stateId: currentStateId, aborted: false });
    }
  };

  const completeIfEmpty = () => {
    if (pendingCount === 0) {
      eventHandler?.("renderComplete", { stateId: currentStateId, aborted: false });
    }
  };

  // ... rest unchanged
};
```

## Test Migration

### Breaking Changes

| Before | After |
|--------|-------|
| `complete:` property on animations | Remove - no per-animation complete |
| `complete:` property on text-revealing | Remove - no per-element complete |
| Event name: `"complete"` | Event name: `"renderComplete"` |
| Payload: `{ _event: {...}, ...actionPayload }` | Payload: `{ stateId, aborted }` |

### VT Specs to Update

#### Animation specs with `complete:` (remove property)
- `vt/specs/recttransition/rect-fade-in.yaml`
- `vt/specs/recttransition/rect-fade-out.yaml`
- `vt/specs/recttransition/rect-slide-out.yaml`
- `vt/specs/recttransition/rect-update-scale.yaml`
- `vt/specs/textbasictransition/text-slide-out-down.yaml`
- `vt/specs/video/videoaddfadeintest/video-add-fade-in.yaml`
- `vt/specs/video/videodeleteabort/delete-abortion-test.yaml`

#### Text-revealing specs with `complete:` (remove property)
- `vt/specs/textrevealingevent/event-complete.yaml`
- `vt/specs/textrevealing/text-revealing-with-indicator.yaml`
- `vt/specs/textrevealing/text-revealing-update-add-indicator.yaml`
- `vt/specs/textrevealing/text-revealing-no-animation.yaml`
- `vt/specs/textbasicevent/event-textstyle-hover.yaml`
- `vt/specs/textbasicevent/event-textstyle-click.yaml`

#### VT Template
- `vt/templates/default.html` - Update eventHandler to handle `renderComplete`

### Example Migration

**Before:**
```yaml
animations:
  - id: "rect-fade-in"
    targetId: "rect1"
    type: tween
    complete:
      actionPayload:
        animationType: tween
        status: finished
    properties:
      alpha:
        initialValue: 0
        keyframes:
          - duration: 1000
            value: 1
            easing: linear
```

**After:**
```yaml
# State now has id
id: "scene-1"
animations:
  - id: "rect-fade-in"
    targetId: "rect1"
    type: tween
    # No complete property - stateComplete event fires when all animations done
    properties:
      alpha:
        initialValue: 0
        keyframes:
          - duration: 1000
            value: 1
            easing: linear
```

### New Test Cases to Add

1. **Render complete with single animation** - verify `renderComplete` fires after animation
2. **Render complete with multiple animations** - verify fires after ALL complete
3. **Render complete with text-revealing** - verify fires after text fully revealed
4. **Render complete with animations + text-revealing** - verify waits for both
5. **Render complete with no animations** - verify fires immediately
6. **Render abort** - verify `aborted: true` when render interrupted
7. **State id in payload** - verify correct `stateId` in event

## Feasibility

**High feasibility** - The implementation:
- Follows existing patterns (state versioning from AnimationBus)
- Doesn't require architectural changes
- Can be done incrementally
- Estimated ~3-4 hours of implementation (including test migration)
