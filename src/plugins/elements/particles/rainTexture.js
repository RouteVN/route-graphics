import { Graphics } from "pixi.js";

export function createRaindropTexture(app) {
  const graphics = new Graphics();
  // Draw a thin vertical line
  graphics.rect(0, 0, 1, 8);
  graphics.fill({ color: 0x88ccff }); // Light blue
  return app.renderer.generateTexture(graphics);
}
