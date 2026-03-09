---
title: review bugfix roadmap from codebase audit
status: done
priority: high
labels: [bug, roadmap, api]
---

# Description

Roadmap for the issues found during the codebase audit. We will fix these in order, one by one, with tests added alongside each change where possible.

# Completed Fix List

1. `findElementByLabel()` threw `ReferenceError`
   - File: `src/RouteGraphics.js`
   - Fixed: replaced the broken custom traversal with Pixi's deep label lookup and added a public API regression test.

2. `updatedBackgroundColor()` did not change the visible background
   - File: `src/RouteGraphics.js`
   - Fixed: the stage background `Graphics` is now stored and redrawn on update, with regression coverage in the public API spec.

3. Video render completion was wrong on non-source updates
   - Files: `src/plugins/elements/video/addVideo.js`, `src/plugins/elements/video/updateVideo.js`, `src/plugins/elements/video/playbackTracking.js`
   - Fixed: playback-completion tracking is now resynced on update, not just on `src` changes, and covered by a focused unit test.

4. Disabling container scroll could break container interactivity
   - Files: `src/plugins/elements/container/updateContainer.js`, `src/plugins/elements/container/util/scrollingUtils.js`
   - Fixed: container interactivity now explicitly owns `eventMode`, and scroll teardown no longer wins over pointer interaction state. A regression test covers `scroll: true -> false`.

5. Public docs and JSDoc types were out of sync with runtime behavior
   - Files: `README.md`, `src/types.js`
   - Fixed: the plugin config shape, `extractBase64()` docs, `updatedBackgroundColor()` docs, and sprite example fields now match the implementation.
