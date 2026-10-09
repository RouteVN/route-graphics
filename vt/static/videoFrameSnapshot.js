// Deterministic capture of the VT's constant-frame-rate video assets. This is
// not a playback implementation: an unavailable presentation callback or an
// unexpected timestamp is an explicit failure, never a readyState substitute.
export const freezeVideoFrame = (
  video,
  { time, framesPerSecond, signal, timeoutMS = 8000 },
) => {
  if (
    !Number.isFinite(time) ||
    !Number.isFinite(framesPerSecond) ||
    framesPerSecond <= 0 ||
    !Number.isFinite(timeoutMS) ||
    timeoutMS <= 0
  ) {
    return Promise.reject(new Error("Invalid VT video frame request"));
  }
  if (
    typeof video.requestVideoFrameCallback !== "function" ||
    typeof video.cancelVideoFrameCallback !== "function"
  ) {
    return Promise.reject(
      new Error("VT video capture requires requestVideoFrameCallback"),
    );
  }

  return new Promise((resolve, reject) => {
    let callbackId;
    let targetTime;
    let expectedMediaTime;
    let presentedMediaTime;
    let seekCompleted = false;
    let started = false;
    let settled = false;
    const epsilon = 0.000002;
    const cleanup = () => {
      clearTimeout(timeout);
      if (callbackId !== undefined) {
        video.cancelVideoFrameCallback(callbackId);
      }
      video.removeEventListener("loadedmetadata", beginSeek);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      video.removeEventListener("play", onUnexpectedPlay);
      signal?.removeEventListener("abort", onAbort);
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      video.pause();
      reject(error);
    };
    const onAbort = () =>
      fail(signal.reason ?? new Error("VT video frame request aborted"));
    const onError = () =>
      fail(new Error(video.error?.message ?? "VT video decoding failed"));
    const onUnexpectedPlay = () => {
      if (!video.paused) {
        fail(new Error("VT video resumed while freezing a frame"));
      }
    };
    const finish = () => {
      if (
        settled ||
        !seekCompleted ||
        presentedMediaTime === undefined ||
        video.seeking ||
        !video.paused ||
        Math.abs(video.currentTime - targetTime) > epsilon ||
        video.readyState < 2 ||
        video.videoWidth <= 0 ||
        video.videoHeight <= 0
      ) {
        return;
      }
      settled = true;
      cleanup();
      resolve({ targetTime, mediaTime: presentedMediaTime });
    };
    const onPresented = (_now, metadata) => {
      callbackId = undefined;
      if (settled) return;
      // A callback already queued for an earlier frame may arrive during the
      // seek. Its mediaTime, not merely HAVE_CURRENT_DATA, must match our frame.
      if (Math.abs(metadata.mediaTime - expectedMediaTime) <= epsilon) {
        presentedMediaTime = metadata.mediaTime;
      }
      finish();
      if (!settled) callbackId = video.requestVideoFrameCallback(onPresented);
    };
    const onSeeked = () => {
      seekCompleted = true;
      finish();
    };
    const beginSeek = () => {
      if (started || settled) return;
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        fail(new Error("VT video requires a finite positive duration"));
        return;
      }
      started = true;
      targetTime = Math.min(
        Math.max(0, time),
        Math.max(0, video.duration - 0.05),
      );
      expectedMediaTime =
        Math.floor(targetTime * framesPerSecond + epsilon) / framesPerSecond;
      // Register before the seek: a paused seek may present before `seeked`,
      // and assigning even the current time requests a fresh decoded frame.
      try {
        callbackId = video.requestVideoFrameCallback(onPresented);
        video.currentTime = targetTime;
      } catch (error) {
        fail(error);
      }
    };
    const timeout = setTimeout(
      () => fail(new Error("Timed out freezing the requested VT video frame")),
      timeoutMS,
    );

    video.pause();
    video.addEventListener("loadedmetadata", beginSeek);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.addEventListener("play", onUnexpectedPlay);
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
    else if (video.error) onError();
    else if (video.readyState >= 1) beginSeek();
  });
};
