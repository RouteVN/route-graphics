/**
 * Snow preset - gentle falling snowflakes.
 * @param {Object} options - { width, height }
 */
export const snow = (options) => ({
  texture: "snowflake",
  lifetime: { min: 4, max: 8 },
  frequency: 0.05,
  particlesPerWave: 2,
  maxParticles: options.count ?? 200,
  emitterLifetime: -1,
  behaviors: [
    {
      type: "spawnShape",
      config: {
        type: "rect",
        data: { x: 0, y: -20, w: options.width ?? 1280, h: 10 },
      },
    },
    {
      type: "movePoint",
      config: {
        speed: { min: 50, max: 150 },
        direction: 90,
      },
    },
    {
      type: "scaleStatic",
      config: { min: 0.3, max: 1.0 },
    },
    {
      type: "alpha",
      config: {
        list: [
          { value: 0, time: 0 },
          { value: 0.8, time: 0.1 },
          { value: 0.8, time: 0.8 },
          { value: 0, time: 1 },
        ],
      },
    },
    {
      type: "rotation",
      config: {
        minStart: 0,
        maxStart: 360,
        minSpeed: -45,
        maxSpeed: 45,
      },
    },
  ],
  spawnBounds: {
    x: -50,
    y: -50,
    width: options.width ?? 1280,
    height: options.height ?? 720,
  },
  recycleOnBounds: true,
});
