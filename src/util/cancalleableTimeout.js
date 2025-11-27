/**
 * @param {number} ms - Milliseconds to sleep
 * @param {AbortSignal} signal
 * @returns {Promise} Promise that resolves after delay
 */
const cancellableTimeout = async (ms, signal) => {
  return new Promise((resolve, reject) => {
    // If the signal is already aborted, reject immediately
    if (signal?.aborted) {
      return reject(new DOMException('The operation was aborted.', 'AbortError'));
    }

    const timerId = setTimeout(() => {
      resolve();
    }, ms);

    const abortListener = () => {
      clearTimeout(timerId);
      reject(signal.reason);
    };

    signal?.addEventListener('abort', abortListener, { once: true });
  });
}

export default cancellableTimeout