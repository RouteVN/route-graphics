import { describe, expect, it, vi } from "vitest";
import { createCompletionTracker } from "../../src/util/completionTracker.js";

describe("completionTracker", () => {
  it("emits renderComplete immediately when nothing is tracked", () => {
    const eventHandler = vi.fn();
    const tracker = createCompletionTracker(eventHandler);

    tracker.reset("state-1");
    tracker.completeIfEmpty();

    expect(eventHandler).toHaveBeenCalledTimes(1);
    expect(eventHandler).toHaveBeenCalledWith("renderComplete", {
      id: "state-1",
      aborted: false,
    });
  });

  it("emits aborted=true for previous state when reset happens with pending work", () => {
    const eventHandler = vi.fn();
    const tracker = createCompletionTracker(eventHandler);

    tracker.reset("state-1");
    const version = tracker.getVersion();
    tracker.track(version);

    tracker.reset("state-2");

    expect(eventHandler).toHaveBeenCalledTimes(1);
    expect(eventHandler).toHaveBeenLastCalledWith("renderComplete", {
      id: "state-1",
      aborted: true,
    });
  });

  it("emits completion only when pending count reaches zero", () => {
    const eventHandler = vi.fn();
    const tracker = createCompletionTracker(eventHandler);

    tracker.reset("state-1");
    const version = tracker.getVersion();
    tracker.track(version);
    tracker.track(version);

    tracker.complete(version);
    expect(eventHandler).not.toHaveBeenCalled();

    tracker.complete(version);
    expect(eventHandler).toHaveBeenCalledTimes(1);
    expect(eventHandler).toHaveBeenCalledWith("renderComplete", {
      id: "state-1",
      aborted: false,
    });
  });

  it("ignores stale complete calls from older render versions", () => {
    const eventHandler = vi.fn();
    const tracker = createCompletionTracker(eventHandler);

    tracker.reset("state-1");
    const staleVersion = tracker.getVersion();
    tracker.track(staleVersion);

    tracker.reset("state-2");
    const currentVersion = tracker.getVersion();
    tracker.track(currentVersion);

    tracker.complete(staleVersion);
    expect(eventHandler).toHaveBeenCalledTimes(1);
    expect(eventHandler).toHaveBeenCalledWith("renderComplete", {
      id: "state-1",
      aborted: true,
    });

    tracker.complete(currentVersion);
    expect(eventHandler).toHaveBeenCalledTimes(2);
    expect(eventHandler).toHaveBeenLastCalledWith("renderComplete", {
      id: "state-2",
      aborted: false,
    });
  });
});
