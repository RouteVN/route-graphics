import { createElementPlugin } from "../elementPlugin.js";
import { addParticle } from "./addParticles.js";
import { deleteParticles } from "./deleteParticles.js";
import { updateParticles } from "./updateParticles.js";
import { parseParticles } from "./parseParticles.js";

// Import presets to trigger registration (side effect)
import "./presets/index.js";

// Export the particles plugin
export const particlesPlugin = createElementPlugin({
  type: "particles",
  add: addParticle,
  update: updateParticles,
  delete: deleteParticles,
  parse: parseParticles,
});

// Re-export emitter classes
export { Emitter, Particle } from "./emitter/index.js";

// Re-export registration functions for library users
export {
  registerParticlePreset,
  registerParticleTexture,
  registerParticleBehavior,
  loadParticlePresets,
} from "./registries.js";
