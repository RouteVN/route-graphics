import { createElementPlugin } from "../elementPlugin.js";
import { addParticle } from "./addParticles.js";
import { deleteParticles } from "./deleteParticles.js";
import { updateParticles } from "./updateParticles.js";

// Export the particles plugin
export const particlesPlugin = createElementPlugin({
  type: "particles_experimental",
  add: addParticle,
  update: updateParticles,
  delete: deleteParticles,
});
