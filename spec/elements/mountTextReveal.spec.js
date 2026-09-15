import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock(
  "../../src/plugins/elements/text-revealing/textRevealingRuntime.js",
  () => ({ runTextReveal: mocks.run }),
);
import { mountTextReveal } from "../../src/plugins/elements/text-revealing/mountTextReveal.js";

describe("text reveal mount/completion ownership", () => {
  beforeEach(() => {
    mocks.run.mockReset();
  });
  const options = () => ({
    container: { destroyed: false },
    signal: new AbortController().signal,
    completionTracker: { getVersion: () => 7, fail: vi.fn() },
    onLayoutMounted: vi.fn(),
  });
  it("publishes readiness only after the layout callback, without completing playback", async () => {
    let runtime, finish;
    mocks.run.mockImplementation((o) => {
      runtime = o;
      return new Promise((r) => {
        finish = r;
      });
    });
    const o = options();
    let ready = false;
    const p = mountTextReveal(o).then(() => {
      ready = true;
    });
    await Promise.resolve();
    expect(ready).toBe(false);
    runtime.onLayoutMounted();
    await p;
    expect(o.onLayoutMounted).toHaveBeenCalledOnce();
    expect(o.completionTracker.fail).not.toHaveBeenCalled();
    finish();
    await Promise.resolve();
  });
  it("rejects setup failure with its original error", async () => {
    const failure = new Error("indicator decode failed");
    mocks.run.mockRejectedValue(failure);
    const o = options();
    await expect(mountTextReveal(o)).rejects.toBe(failure);
    expect(o.completionTracker.fail).not.toHaveBeenCalled();
  });
  it("settles early exits without inventing a mounted-layout callback", async () => {
    mocks.run.mockResolvedValue();
    const o = options();
    await mountTextReveal(o);
    expect(o.onLayoutMounted).not.toHaveBeenCalled();
  });
  it.each(["current", "aborted", "destroyed"])(
    "owns post-mount errors in their original scope (%s)",
    async (scope) => {
      let reject;
      mocks.run.mockImplementation((o) => {
        o.onLayoutMounted();
        return new Promise((_, r) => {
          reject = r;
        });
      });
      const o = options(),
        controller = new AbortController();
      o.signal = controller.signal;
      await mountTextReveal(o);
      if (scope === "aborted") controller.abort();
      if (scope === "destroyed") o.container.destroyed = true;
      const failure = new Error("later prefix failed");
      reject(failure);
      await Promise.resolve();
      if (scope === "current")
        expect(o.completionTracker.fail).toHaveBeenCalledExactlyOnceWith(
          7,
          failure,
        );
      else expect(o.completionTracker.fail).not.toHaveBeenCalled();
    },
  );
});
