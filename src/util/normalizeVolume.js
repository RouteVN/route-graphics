const toFiniteNumber = (value, fallback) => {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }

  const parsedFallback = Number(fallback);
  return Number.isFinite(parsedFallback) ? parsedFallback : 100;
};

export const normalizeVolume = (volume, fallback = 100) => {
  const nextVolume = toFiniteNumber(volume ?? fallback, fallback);
  return Math.min(Math.max(nextVolume, 0), 100) / 100;
};
