/**
 * Built-in particle presets.
 * Each preset is a factory function that receives options and returns emitter config.
 */

import { registerParticlePreset } from "../registries.js";
import { snow } from "./snow.js";
import { rain } from "./rain.js";
import { fire } from "./fire.js";
import { burst } from "./burst.js";

// Register built-in presets
registerParticlePreset("snow", snow);
registerParticlePreset("rain", rain);
registerParticlePreset("fire", fire);
registerParticlePreset("burst", burst);
registerParticlePreset("explosion", burst); // Alias

export { snow, rain, fire, burst };
