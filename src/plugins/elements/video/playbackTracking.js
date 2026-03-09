const hasVideoPlaybackCompleted = (video) => {
  if (!video) return true;
  if (video.ended) return true;

  return (
    Number.isFinite(video.duration) &&
    video.duration > 0 &&
    video.currentTime >= video.duration
  );
};

export const clearVideoPlaybackTracking = ({ videoElement, video }) => {
  if (video && videoElement?._videoEndedListener) {
    video.removeEventListener("ended", videoElement._videoEndedListener);
  }

  if (videoElement) {
    videoElement._videoEndedListener = undefined;
    videoElement._playbackStateVersion = null;
  }
};

export const syncVideoPlaybackTracking = ({
  videoElement,
  video,
  loop,
  completionTracker,
}) => {
  clearVideoPlaybackTracking({ videoElement, video });

  if (loop ?? false) {
    return;
  }

  if (hasVideoPlaybackCompleted(video)) {
    return;
  }

  const playbackStateVersion = completionTracker.getVersion();
  completionTracker.track(playbackStateVersion);

  const onEnded = () => {
    completionTracker.complete(playbackStateVersion);
  };

  video.addEventListener("ended", onEnded);
  videoElement._videoEndedListener = onEnded;
  videoElement._playbackStateVersion = playbackStateVersion;
};
