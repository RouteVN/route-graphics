/**
 * @param {number} ms - Milliseconds to sleep
 * @param {AbortSignal} signal
 * @returns {Promise} Promise that resolves after delay
 */
const abortableSleep = async (ms, signal) => {
  return new Promise((resolve, reject) => {
    // If the signal is already aborted, reject immediately
    if (signal?.aborted) {
      return reject(
        new DOMException("The operation was aborted.", "AbortError"),
      );
    }

    let abortListener;
    const cleanup = () => {
      if (abortListener) {
        signal?.removeEventListener("abort", abortListener);
      }
    };

    const timerId = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    abortListener = () => {
      clearTimeout(timerId);
      cleanup();
      reject(signal.reason);
    };

    signal?.addEventListener("abort", abortListener, { once: true });
  });
};

export default abortableSleep;
