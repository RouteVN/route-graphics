// Elements with the same src share one video, so a video can hold the
// playback completions of several elements.
const playbackCompletionsByVideo = new WeakMap();

// Videos whose last play() the browser refused. They stay paused, and only a
// mount or a source change plays them again.
const refusedVideos = new WeakSet();

const hasVideoPlaybackSettled = (video) => {
  if (!video) return true;
  if (video.ended) return true;
  if (video.error) return true;
  if (refusedVideos.has(video)) return true;
  if (
    typeof video.NETWORK_NO_SOURCE === "number" &&
    video.networkState === video.NETWORK_NO_SOURCE
  ) {
    return true;
  }

  return (
    Number.isFinite(video.duration) &&
    video.duration > 0 &&
    video.currentTime >= video.duration
  );
};

export const clearVideoPlaybackTracking = ({ videoElement, video }) => {
  if (video && videoElement?._videoEndedListener) {
    video.removeEventListener("ended", videoElement._videoEndedListener);
    playbackCompletionsByVideo
      .get(video)
      ?.delete(videoElement._videoEndedListener);
  }

  if (video && videoElement?._videoErrorListener) {
    video.removeEventListener("error", videoElement._videoErrorListener);
  }

  if (videoElement) {
    videoElement._videoEndedListener = undefined;
    videoElement._videoErrorListener = undefined;
    videoElement._playbackStateVersion = null;
  }
};

export const disposeVideoPlayback = (videoElement, completionTracker) => {
  if (videoElement._playbackDisposed) return;
  videoElement._playbackDisposed = true;
  const version = videoElement._playbackStateVersion;
  const texture = videoElement.texture;
  const video = texture?.source?.resource;
  // Pixi 8.10.2 does not detach dynamic texture listeners in Sprite.destroy().
  texture?.off?.("update", videoElement.onViewUpdate, videoElement);
  clearVideoPlaybackTracking({ videoElement, video });
  video?.pause?.();
  unregisterManagedVideoSprite(videoElement);
  if (version !== null && version !== undefined)
    completionTracker?.complete?.(version);
};

export const syncVideoPlaybackTracking = ({
  videoElement,
  video,
  loop,
  completionTracker,
  willPlay = false,
}) => {
  clearVideoPlaybackTracking({ videoElement, video });

  // A video that is about to be played again may play this time.
  if (willPlay && video) {
    refusedVideos.delete(video);
  }

  if (loop ?? false) {
    return;
  }

  if (hasVideoPlaybackSettled(video)) {
    return;
  }

  const playbackStateVersion = completionTracker.getVersion();
  completionTracker.track(playbackStateVersion);

  const completePlayback = () => {
    // Complete once: a source that fails to load fires error and also
    // rejects play().
    clearVideoPlaybackTracking({ videoElement, video });
    completionTracker.complete(playbackStateVersion);
  };

  video.addEventListener("ended", completePlayback);
  video.addEventListener("error", completePlayback);
  videoElement._videoEndedListener = completePlayback;
  videoElement._videoErrorListener = completePlayback;
  videoElement._playbackStateVersion = playbackStateVersion;
  const completions = playbackCompletionsByVideo.get(video) ?? new Set();
  completions.add(completePlayback);
  playbackCompletionsByVideo.set(video, completions);
};

/**
 * Start a video. The browser rejects play() when it does not allow playback,
 * such as autoplay with sound outside a user gesture (NotAllowedError), and
 * when a pause() or a new load interrupts the start (AbortError).
 * @param {HTMLVideoElement} video
 */
export const playVideo = (video) => {
  video.play()?.catch((error) => {
    // Whatever paused or reloaded the video decides its playback.
    if (error?.name === "AbortError") return;

    // A video that does not play never ends: complete its playback as for a
    // video that fails to load, so the render does not wait forever, and
    // treat it as settled until it is played again. Iterate a copy: a
    // completion can start a render that tracks this video anew.
    refusedVideos.add(video);
    const completions = [...(playbackCompletionsByVideo.get(video) ?? [])];
    for (const completePlayback of completions) {
      completePlayback();
    }
  });
};
import { unregisterManagedVideoSprite } from "./managedVideoTextureSizing.js";
