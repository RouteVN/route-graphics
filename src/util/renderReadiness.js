// Scene mounting/presentation is independent of animation/reveal completion.
// Observe rejections internally: existing synchronous render() callers need
// not opt into readiness, and must not acquire unhandled Promise rejections.
export const createRenderReadiness = () => {
  let current;
  let rejectCurrent;
  return {
    begin(signal) {
      let resolve;
      let reject;
      let settled = false;
      const promise = new Promise((accept, fail) => {
        resolve = accept;
        reject = fail;
      });
      void promise.catch(() => {});
      const settle = (callback, value) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener("abort", abort);
        callback(value);
      };
      const abort = () => {
        const error = new Error(
          "Render was superseded or destroyed before it was ready.",
        );
        error.name = "AbortError";
        settle(reject, error);
      };
      current = promise;
      rejectCurrent = (error) => settle(reject, error);
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
      return {
        resolve: () => settle(resolve),
        reject: (error) => settle(reject, error),
      };
    },
    wait() {
      return (
        current ??
        Promise.reject(new Error("No active render has been requested."))
      );
    },
    reject(error) {
      rejectCurrent?.(error);
    },
    presentedUnchanged() {
      // An initial empty scene can equal the empty diff baseline. A genuinely
      // pending equal render must keep its original readiness reservation.
      current ??= Promise.resolve();
    },
    clear() {
      current = undefined;
      rejectCurrent = undefined;
    },
  };
};
