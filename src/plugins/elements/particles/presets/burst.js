/**
 * Burst preset - one-shot outward explosion.
 * @param {Object} options - { x, y }
 */
export const burst = (options) => ({
  texture: "circle",
  lifetime: { min: 0.5, max: 1.0 },
  frequency: 0,
  particlesPerWave: options.count ?? 50,
  maxParticles: options.count ?? 50,
  emitterLifetime: 0.1,
  behaviors: [
    {
      type: "spawnShape",
      config: {
        type: "circle",
        data: {
          x: options.x ?? 0,
          y: options.y ?? 0,
          radius: 10,
          affectRotation: true,
        },
      },
    },
    {
      type: "speedStatic",
      config: { min: 200, max: 400 },
    },
    {
      type: "scale",
      config: {
        list: [
          { value: 1, time: 0 },
          { value: 0, time: 1 },
        ],
      },
    },
    {
      type: "alpha",
      config: {
        list: [
          { value: 1, time: 0 },
          { value: 0, time: 1 },
        ],
      },
    },
  ],
});
