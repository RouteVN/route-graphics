# Element Replacement Lifecycle

Last updated: 2026-07-15

Status: implemented and verified for PR #307

## Goal

Make a same-ID element type change behave as one logical replacement even when:

- plugin deletion or mounting is asynchronous
- another render supersedes the originating render
- a container rebuild reparents its children
- a custom composite plugin renders into an arbitrary internal slot
- an application is destroyed
- the replacement starts animations
- a transition is prepared after the normal animation flush
- a live transition subject performs asynchronous final cleanup
- Pixi automatic rendering is disabled

The design must keep plugin lifecycle dispatch, render completion, and the
presented canvas consistent with the latest requested JSON state.

## Root Cause

Route Graphics has two different kinds of state:

- logical state: element IDs, owners, types, and properties from the latest JSON
  render state
- physical state: Pixi display objects and their current parent containers

Logical identity persists across renders. Physical parents do not. In
particular, scrolling setup removes and recreates a `*-content` container while
moving the same child display objects into the new container.

The previous implementation attached pending replacements to a physical parent.
It also treated an unrecognized physical parent as proof that its children
matched the already-committed JSON state. Those assumptions fail after a scroll
parent rebuild and while asynchronous plugin work is still settling.

An asynchronous replacement is also part of the render transaction. Every
Promise-producing phase (delete, add, and final transition cleanup) must remain
reserved in the completion tracker until it settles. A frame must be requested
after a delayed display-tree mutation, and a transition installed after the
normal render-time animation flush must be activated immediately.

## Required Invariants

### 1. Logical identity owns the replacement

A pending replacement is keyed by:

```text
(owner element ID, element ID)
```

The physical Pixi parent is an operation-time location, not replacement
identity. It must be resolved again whenever deferred work continues.

### 2. A display object's live marker survives reparenting

The element definition attached to a live display object is authoritative for
its mounted type. Moving that object into a newly created parent must not replace
its marker with the optimistically committed JSON type.

When live and committed types match, the committed definition supplies the
latest properties. When their types differ, the live definition selects the
lifecycle plugin until the replacement actually mounts.

### 3. The latest root render owns deferred continuation

Each root render publishes one current lifecycle snapshot containing:

- the latest desired logical tree
- the current cancellation signal
- the current mount callback
- the current completion tracker/version
- the current frame-request callback

A superseding render replaces this snapshot synchronously. Pending operations do
not copy or transfer these fields individually.

### 4. Render parents are observed, not inferred

Every `renderElements()` call registers its actual `parent` for each immediate
logical child. Deferred work resolves that registered parent by logical key.

If the registered parent was destroyed or disconnected, resolution uses the
live marked child or the rebuilt built-in `*-content` container. The built-in
naming convention is only a recovery path; custom composite slots do not need to
follow it.

### 5. Cleanup is revalidated after every asynchronous boundary

After an asynchronous previous-plugin deletion settles, the replacement must:

1. resolve the current physical render parent from its logical owner
2. check whether the previous live type is still mounted there
3. rerun previous-plugin cleanup against the new parent when reparenting made the
   original cleanup stale
4. mount the latest desired type only after previous cleanup is complete

The implementation must not mount a second same-ID object beside a stale live
object. A cleanup rejection must be returned through the operation promise.

### 6. Every asynchronous replacement phase is reserved before return

As soon as either the previous delete or next add hook returns a Promise, the
replacement reserves one completion for the current tracker version.

When a newer render adopts the operation, it reserves the pending operation in
the newer tracker version. The reservation is released only after cleanup and
the selected latest mount have settled. Any update animation started by that
mount owns its separate completion, so `renderComplete` cannot precede it.

### 7. Deferred display mutations request presentation

When deferred cleanup/mounting reaches a terminal state, request `app.render()`
for the current live render. This applies when:

- a replacement mounts a new object
- the latest desired state removed the element, so cleanup is the only mutation

Do not request a frame for an aborted, destroyed, or superseded-without-adoption
render.

### 8. Deferred transitions activate atomically

If asynchronous preparation installs a non-persistent transition after the
normal `animationBus.flush()`, its `START` command is flushed immediately. A
newer render can therefore cancel an active transition; it cannot miss a queued
start that later resurrects stale output.

Persistent transitions re-resolve their logical render parent after async
cleanup and install into the current parent, even when scrolling rebuilt the
original parent while the transition was pending.

### 9. Live transition cleanup owns completion and resources

When a plain transition keeps an `AnimatedSprite` tree live, the previous
plugin's final delete may be asynchronous. The next logical object is presented
synchronously so a superseding render can reconcile its real plugin type, while
the overlay, deferred effects, and completion reservation remain alive until
cleanup settles.

Cleanup rejection is observed, temporary resources are released, and the
returned completion callback Promise remains rejectable to a direct caller.

### 10. Snapshot transition cleanup follows replacement ordering

For cross-type transitions, an asynchronous previous-plugin delete must settle
before the next same-ID live object and transition overlay are installed.

The transition operation must remain completion-tracked while waiting. A delete
rejection must clean up temporary transition resources, release completion, and
remain observable through the returned Promise.

## Lifecycle State

One lifecycle is associated with the logical root passed to `renderElements()`
and shared with nested container renders through `renderContext`.

Conceptually:

```js
{
  rootParent,
  currentRender: {
    signal,
    mountElement,
    updateElement,
    deleteElement,
    completionTracker,
    requestFrame,
  },
  desiredElements: Map<LogicalKey, { element, ownerElementId, zIndex }>,
  pendingReplacements: Map<LogicalKey, ReplacementRecord>,
  renderParents: Map<LogicalKey, PixiContainer>,
}
```

A replacement record contains stable logical facts only:

```js
{
  ownerElementId,
  id,
  prevElement,
  completionReservation,
}
```

It does not treat the physical parent captured at replacement start as current
after an asynchronous boundary.

## State Transitions

### Start

1. Diff detects a same-ID type change.
2. Invoke the previous plugin's delete hook without the originating render's
   abort signal; a newer render may adopt this cleanup.
3. If deletion is synchronous, mount the requested next type synchronously.
4. If either operation is asynchronous, register the logical replacement and
   reserve render completion before returning.

### Superseding render

1. Publish the new desired tree and render callbacks.
2. Reserve every still-pending replacement in the new completion version.
3. Diff against live display-object markers.
4. Skip ordinary add/update/delete dispatch for logical keys already owned by a
   pending replacement.

### Deferred continuation

1. Re-resolve the current registered physical parent from the logical key.
2. If the old live type remains, run cleanup against that parent and await it.
3. Read the latest desired element for the logical key.
4. If desired, mount it into the resolved current parent.
5. If absent, leave the element removed.
6. Release the current completion reservation.
7. Request a frame.

### Abort or destroy

If no newer live render adopted the operation, the current signal is aborted or
the logical root is destroyed. Deferred cleanup may finish, but no new element or
frame is produced. The stale completion version is harmless because tracker
versions reject stale completion calls.

## Regression Test Matrix

Every review finding must have a test that fails before its production fix.

| ID   | Scenario                                                                                                            | Expected result                                                                                               | Test location                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| R1   | Live type A is moved into a newly rebuilt scroll content parent while committed state says B; next state requests C | A's delete plugin is used; B's plugin is never dispatched against A                                           | `spec/elements/elementReplacementLifecycle.spec.js` |
| R2   | A→B waits on async A cleanup; scrolling rebuilds the content parent while B is retained                             | Cleanup retargets to the new parent; exactly one B mounts there; no A remains                                 | `spec/elements/elementReplacementLifecycle.spec.js` |
| R3a  | Cross-type transition uses async previous-plugin delete                                                             | Returned operation remains pending and no next same-ID live object is installed before cleanup settles        | `spec/animations/runReplaceAnimation.spec.js`       |
| R3b  | Async transition delete rejects                                                                                     | Returned operation rejects observably and transition completion/resources are cleaned up                      | `spec/animations/runReplaceAnimation.spec.js`       |
| R4   | Async cleanup delays a replacement whose mount starts an update animation                                           | No early `renderComplete`; exactly one successful event fires after cleanup, mount, and animation completion  | `spec/elements/elementReplacementLifecycle.spec.js` |
| R5a  | Deferred cleanup finishes and mounts the retained latest element                                                    | `app.render()` is requested after the mount                                                                   | `spec/elements/elementReplacementLifecycle.spec.js` |
| R5b  | A newer state removes the pending element before cleanup settles                                                    | Cleanup requests `app.render()` even though no replacement mounts                                             | `spec/elements/elementReplacementLifecycle.spec.js` |
| R6   | Previous cleanup is synchronous and the next plugin add is asynchronous                                             | Completion is reserved before return; mount animations and presentation finish before `renderComplete`        | `spec/elements/elementReplacementLifecycle.spec.js` |
| R7   | A custom composite renders children into an internal slot with no `*-content` label                                 | Deferred replacement mounts back into the exact registered slot, never directly under the owner               | `spec/elements/elementReplacementLifecycle.spec.js` |
| R8   | Persistent A→B transition waits on async cleanup while a newer render rebuilds its scrolling parent                 | Cleanup retries and B plus its overlay install in the rebuilt parent; the transition completes normally       | `spec/elements/elementReplacementLifecycle.spec.js` |
| R9   | Async cleanup installs a non-persistent transition after the render-time animation flush                            | The transition is active immediately and cannot survive a subsequent `cancelAllExcept()` as a queued start    | `spec/animations/runReplaceAnimation.spec.js`       |
| R10a | A live `AnimatedSprite` transition subject uses async previous-plugin cleanup                                       | Next is synchronously reconcilable, but overlay resources and completion remain pending until cleanup settles | `spec/animations/runReplaceAnimation.spec.js`       |
| R10b | Live previous-plugin cleanup rejects                                                                                | Rejection is observed and returned; temporary resources and completion are released exactly once              | `spec/animations/runReplaceAnimation.spec.js`       |
| R11  | Async B add is superseded by desired type C before B mounts                                                         | Physical B is marked as B, deleted through B's plugin, and replaced by exactly one C                          | `spec/elements/elementReplacementLifecycle.spec.js` |
| R12  | A custom composite moves a pending child to a new slot but leaves the old slot connected                            | The marked live child's new slot supersedes stale registration; cleanup and mount target the new slot         | `spec/elements/elementReplacementLifecycle.spec.js` |

Existing tests remain required for:

- abort without adoption never mounting stale output
- application/parent destruction never mounting stale output
- retained replacement adoption through an unchanged nested container
- superseding an async transition selecting the actual live plugin
- synchronous same-ID type replacement
- asynchronous next-plugin mount

## Browser VT Coverage

The VT template registers three test-only rectangle plugins:

- `vt-deferred-rect` pauses its first delete until the spec dispatches
  `vtResolveDeferredRectDelete`
- `vt-deferred-add-rect` pauses its first add until the spec dispatches
  `vtResolveDeferredRectAdd`
- `vt-strict-rect` throws if its lifecycle is dispatched against a display
  object mounted by another plugin

This keeps the browser sequences deterministic while still exercising the real
Route Graphics parser, Pixi display tree, completion tracker, manual animation
clock, and canvas presentation.

| Scenario                      | Spec                                                                        | Browser guarantees                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Retained replacement adoption | `vt/specs/container/deferred-element-replacement-adoption.yaml`             | A remains live while scrolling reparents it; B mounts in the current parent; completion waits for B's animation     |
| Latest-state removal          | `vt/specs/container/deferred-element-replacement-removal.yaml`              | B is never dispatched against live A; cleanup retargets after reparenting; the cleanup-only frame removes A visibly |
| Replace-transition ordering   | `vt/specs/replacetransition/deferred-previous-plugin-delete.yaml`           | No transition is installed before A cleanup settles; completion waits for transition playback; B owns final output  |
| Async replacement add         | `vt/specs/elements/deferred-replacement-add.yaml`                           | Completion waits for async B mounting and the deferred mount explicitly presents the final canvas frame             |
| Persistent transition rebuild | `vt/specs/replacetransition/persistent-deferred-delete-parent-rebuild.yaml` | Pending continuity survives scrolling reparenting; cleanup and installation retarget to the rebuilt parent          |

The five specs produce sixteen browser screenshots.

## Implementation Boundaries

Expected production changes are limited to:

- `src/plugins/elements/elementRenderState.js`
- `src/plugins/elements/renderElements.js`
- `src/plugins/animations/replace/runReplaceAnimation.js`
- container code only if logical render-parent registration cannot be resolved
  reliably from the root display tree

The release package version is `1.27.0`.

## Verification Result

Completed on 2026-07-15:

1. Every reported R6 through R10 regression was observed failing on the
   pre-fix implementation before its production fix.
2. R1 through R12 pass after the implementation.
3. Existing replacement, transition, container, completion, and public API tests
   pass.
4. The full suite passes: 87 test files and 672 tests.
5. Prettier validation and the production build pass.
6. The five targeted browser VT specs pass with 16/16 matching references.
7. The package version is `1.27.0` for this release.
