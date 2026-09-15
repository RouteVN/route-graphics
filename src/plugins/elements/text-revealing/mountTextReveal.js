import { runTextReveal } from "./textRevealingRuntime.js";

// Element preparation ends at the first mounted layout. The existing runtime
// still owns the complete reveal, sound cleanup, abort and completion count.
// In particular, do not discard a late rejection after readiness has settled.
export const mountTextReveal = (options) => {
  const version = options.completionTracker?.getVersion?.();
  return new Promise((resolve, reject) => {
    let mounted = false;
    const operation = runTextReveal({
      ...options,
      onLayoutMounted: () => {
        options.onLayoutMounted?.();
        mounted = true;
        resolve();
      },
    });
    void operation.then(resolve, (error) => {
      if (!mounted) {
        reject(error);
      } else if (!options.signal?.aborted && !options.container.destroyed) {
        options.completionTracker.fail(version, error);
      }
    });
  });
};
