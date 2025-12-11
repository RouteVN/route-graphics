/**
 * Rain preset - fast falling raindrops.
 * @param {Object} options - { width, height }
 */
export const rain = (options) => ({
  texture: "raindrop",
  lifetime: { min: 0.8, max: 1.5 },
  frequency: 0.001,
  particlesPerWave: 3,
  maxParticles: options.count ?? 300,
  emitterLifetime: -1,
  behaviors: [
    {
      type: "spawnShape",
      config: {
        type: "rect",
        data: { x: -50, y: -50, w: options.width ?? 1280, h: 10 },
      },
    },
    {
      type: "movePoint",
      config: {
        speed: { min: 640, max: 960 },
        direction: 85,
      },
    },
    {
      type: "scaleStatic",
      config: { min: 0.8, max: 1.2 },
    },
    {
      type: "alpha",
      config: {
        list: [
          { value: 0, time: 0 },
          { value: 0.6, time: 0.1 },
          { value: 0.6, time: 0.8 },
          { value: 0, time: 1 },
        ],
      },
    },
    {
      type: "noRotation",
      config: { rotation: -5 },
    },
  ],
  spawnBounds: { x: -100, y: -100, width: options.width ?? 1280, height: options.height ?? 720 },
  recycleOnBounds: true,
});
