// Opt-in VT clock for typewriter reveals, which use timeouts rather than the
// animation bus. Yield through a native task so async continuations can enqueue
// their next timeout before choosing the next virtual deadline.
export const createManualTimeoutClock = (host) => {
  const nativeSetTimeout = host.setTimeout.bind(host);
  const nativeClearTimeout = host.clearTimeout.bind(host);
  const pending = new Map();
  let now = 0;
  let nextId = -1;
  let installed = false;
  let settled = Promise.resolve();

  return {
    install() {
      if (installed) return;
      installed = true;
      host.setTimeout = (callback, delay = 0, ...args) => {
        const id = nextId--;
        pending.set(id, {
          at: now + Math.max(0, Number(delay) || 0),
          run: () => callback(...args),
        });
        return id;
      };
      host.clearTimeout = (id) => {
        if (!pending.delete(id)) nativeClearTimeout(id);
      };
    },
    advance(deltaMS) {
      settled = settled.then(async () => {
        if (!installed || !Number.isFinite(deltaMS) || deltaMS < 0) {
          throw new Error(
            "Install the VT timeout clock and advance by a finite, nonnegative duration",
          );
        }
        const target = now + deltaMS;
        while (true) {
          await new Promise((resolve) => nativeSetTimeout(resolve, 0));
          const next = [...pending].sort((a, b) => a[1].at - b[1].at)[0];
          if (!next || next[1].at > target) break;
          const [id, timer] = next;
          pending.delete(id);
          now = timer.at;
          timer.run();
        }
        now = target;
      });
    },
    async idle() {
      await settled;
      return true;
    },
  };
};
