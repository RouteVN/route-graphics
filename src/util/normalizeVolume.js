export const normalizeVolume = (volume, fallback = 100) =>
  Math.min(Math.max(volume ?? fallback, 0), 100) / 100;
