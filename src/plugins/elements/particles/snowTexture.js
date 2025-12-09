import { Graphics } from "pixi.js";

export function createSnowflakeTexture(app) {
  const graphics = new Graphics();
  graphics.circle(0, 0, 3); // Small circle
  graphics.fill({ color: 0xffffff });

  // Convert graphics to texture
  return app.renderer.generateTexture(graphics);
}
