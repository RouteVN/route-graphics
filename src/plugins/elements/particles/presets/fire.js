/**
 * Fire preset - rising sparks with color gradient.
 * @param {Object} options - { x, y }
 */
export const fire = (options) => ({
  texture: "circle",
  lifetime: { min: 0.5, max: 1.5 },
  frequency: 0.02,
  particlesPerWave: 2,
  maxParticles: options.count ?? 100,
  emitterLifetime: -1,
  behaviors: [
    {
      type: "spawnShape",
      config: {
        type: "rect",
        data: { x: options.x ?? 0, y: options.y ?? 0, w: 40, h: 10 },
      },
    },
    {
      type: "acceleration",
      config: {
        accel: { x: 0, y: -200 },
        minStart: 50,
        maxStart: 150,
        rotate: false,
        maxSpeed: 0,
      },
    },
    {
      type: "scale",
      config: {
        list: [
          { value: 1, time: 0 },
          { value: 0.3, time: 1 },
        ],
        minMult: 0.5,
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
    {
      type: "color",
      config: {
        list: [
          { value: "#ffff00", time: 0 },
          { value: "#ff6600", time: 0.5 },
          { value: "#ff0000", time: 1 },
        ],
      },
    },
    {
      type: "rotationStatic",
      config: { min: -90, max: -90 },
    },
  ],
});
