import { Graphics } from "pixi.js";

export function createCircleTexture(app) {
  const graphics = new Graphics();
  // Draw a small circle for fire/spark particle
  graphics.circle(0, 0, 4);
  graphics.fill({ color: 0xffffff }); // White, will be tinted by color behavior
  return app.renderer.generateTexture(graphics);
}
