# Element Replacement Lifecycle

Last updated: 2026-07-15

Status: implemented and verified for PR #307

## Goal

Make a same-ID element type change behave as one logical replacement even when:

- plugin deletion or mounting is asynchronous
- another render supersedes the originating render
- a container rebuild reparents its children
- an application is destroyed
- the replacement starts animations
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

An asynchronous replacement is also part of the render transaction. It must be
reserved in the completion tracker before `renderInternal()` calls
`completeIfEmpty()`, and a frame must be requested after the delayed display-tree
mutation finishes.

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

### 4. Cleanup is revalidated after every asynchronous boundary

After an asynchronous previous-plugin deletion settles, the replacement must:

1. resolve the current physical render parent from its logical owner
2. check whether the previous live type is still mounted there
3. rerun previous-plugin cleanup against the new parent when reparenting made the
   original cleanup stale
4. mount the latest desired type only after previous cleanup is complete

The implementation must not mount a second same-ID object beside a stale live
object. A cleanup rejection must be returned through the operation promise.

### 5. Completion is reserved before returning from render

As soon as a delete hook returns a Promise, the replacement reserves one
completion for the current tracker version.

When a newer render adopts the operation, it reserves the pending operation in
the newer tracker version. The reservation is released only after cleanup and
the selected latest mount have settled. Any update animation started by that
mount owns its separate completion, so `renderComplete` cannot precede it.

### 6. Deferred display mutations request presentation

When deferred cleanup/mounting reaches a terminal state, request `app.render()`
for the current live render. This applies when:

- a replacement mounts a new object
- the latest desired state removed the element, so cleanup is the only mutation

Do not request a frame for an aborted, destroyed, or superseded-without-adoption
render.

### 7. Transition cleanup follows the same ordering

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
4. If deletion is asynchronous, register the logical replacement and reserve
   render completion before returning.

### Superseding render

1. Publish the new desired tree and render callbacks.
2. Reserve every still-pending replacement in the new completion version.
3. Diff against live display-object markers.
4. Skip ordinary add/update/delete dispatch for logical keys already owned by a
   pending replacement.

### Deferred continuation

1. Re-resolve the current physical parent from `rootParent` and owner ID.
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

| ID  | Scenario                                                                                                            | Expected result                                                                                              | Test location                                       |
| --- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| R1  | Live type A is moved into a newly rebuilt scroll content parent while committed state says B; next state requests C | A's delete plugin is used; B's plugin is never dispatched against A                                          | `spec/elements/elementReplacementLifecycle.spec.js` |
| R2  | A→B waits on async A cleanup; scrolling rebuilds the content parent while B is retained                             | Cleanup retargets to the new parent; exactly one B mounts there; no A remains                                | `spec/elements/elementReplacementLifecycle.spec.js` |
| R3a | Cross-type transition uses async previous-plugin delete                                                             | Returned operation remains pending and no next same-ID live object is installed before cleanup settles       | `spec/animations/runReplaceAnimation.spec.js`       |
| R3b | Async transition delete rejects                                                                                     | Returned operation rejects observably and transition completion/resources are cleaned up                     | `spec/animations/runReplaceAnimation.spec.js`       |
| R4  | Async cleanup delays a replacement whose mount starts an update animation                                           | No early `renderComplete`; exactly one successful event fires after cleanup, mount, and animation completion | `spec/elements/elementReplacementLifecycle.spec.js` |
| R5a | Deferred cleanup finishes and mounts the retained latest element                                                    | `app.render()` is requested after the mount                                                                  | `spec/elements/elementReplacementLifecycle.spec.js` |
| R5b | A newer state removes the pending element before cleanup settles                                                    | Cleanup requests `app.render()` even though no replacement mounts                                            | `spec/elements/elementReplacementLifecycle.spec.js` |

Existing tests remain required for:

- abort without adoption never mounting stale output
- application/parent destruction never mounting stale output
- retained replacement adoption through an unchanged nested container
- superseding an async transition selecting the actual live plugin
- synchronous same-ID type replacement
- asynchronous next-plugin mount

## Implementation Boundaries

Expected production changes are limited to:

- `src/plugins/elements/elementRenderState.js`
- `src/plugins/elements/renderElements.js`
- `src/plugins/animations/replace/runReplaceAnimation.js`
- container code only if logical render-parent registration cannot be resolved
  reliably from the root display tree

The package version must remain equal to `main`.

## Verification Result

Completed on 2026-07-15:

1. R1 through R5b were observed failing on the pre-fix implementation.
2. R1 through R5b pass after the implementation.
3. Existing replacement, transition, container, completion, and public API tests
   pass.
4. The full suite passes: 86 test files and 663 tests.
5. Prettier validation and the production build pass.
6. The package version remains `1.26.0`, equal to `main`.
