// What Pixi itself uses when its probe video fails to load.
export const FALLBACK_VIDEO_ALPHA_MODE = "premultiply-alpha-on-upload";
export const VIDEO_ALPHA_MODE_PROBE_TIMEOUT_MS = 1000;

/**
 * Bounds Pixi's detectVideoAlphaMode().
 *
 * Pixi loads a tiny WebM from a data URL and waits for `loadeddata` or
 * `error`. WebKit on iPadOS 27 fires `loadedmetadata` for it and then
 * suspends, so neither event comes, the promise never settles, and every
 * video texture waiting on it never loads.
 *
 * The first caller waits up to `timeoutMs`. After a timeout, callers get the
 * fallback at once, and the detected mode if the probe settles later.
 *
 * @param {() => Promise<string>} detect
 * @param {{ timeoutMs?: number }} [options]
 * @returns {() => Promise<string>}
 */
export const createBoundedVideoAlphaModeDetector = (
  detect,
  { timeoutMs = VIDEO_ALPHA_MODE_PROBE_TIMEOUT_MS } = {},
) => {
  let probe;
  let detectedMode;
  let didTimeOut = false;

  return async () => {
    if (detectedMode !== undefined) {
      return detectedMode;
    }

    // The executor starts the probe at once and turns a throw into a rejection.
    probe ??= new Promise((resolve) => resolve(detect()))
      .catch(() => FALLBACK_VIDEO_ALPHA_MODE)
      .then((mode) => {
        detectedMode = mode;
        return mode;
      });

    if (didTimeOut) {
      return FALLBACK_VIDEO_ALPHA_MODE;
    }

    let timeoutId;
    const timeout = new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        didTimeOut = true;
        resolve(FALLBACK_VIDEO_ALPHA_MODE);
      }, timeoutMs);
    });

    try {
      return await Promise.race([probe, timeout]);
    } finally {
      clearTimeout(timeoutId);
    }
  };
};
