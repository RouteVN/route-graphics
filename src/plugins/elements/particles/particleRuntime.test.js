import { describe, expect, it, vi } from "vitest";
import { Container } from "pixi.js";
import { cleanupParticlesInTree } from "./particleRuntime.js";

describe("particle runtime cleanup", () => {
  it("cleans nested particle emitters before a parent subtree is destroyed", () => {
    const tickerCallback = vi.fn();
    const customTickerHandler = vi.fn();
    const emitter = {
      destroy: vi.fn(),
    };
    const app = {
      ticker: {
        remove: vi.fn(),
      },
    };
    const root = new Container();
    const nested = new Container();
    const particleElement = new Container();
    particleElement.emitter = emitter;
    particleElement.tickerCallback = tickerCallback;
    particleElement.customTickerHandler = customTickerHandler;
    nested.addChild(particleElement);
    root.addChild(nested);

    cleanupParticlesInTree({ app, root });
    root.destroy({ children: true });

    expect(app.ticker.remove).toHaveBeenCalledWith(tickerCallback);
    expect(emitter.destroy).toHaveBeenCalledTimes(1);
    expect(particleElement.emitter).toBeUndefined();
    expect(particleElement.tickerCallback).toBeUndefined();
    expect(particleElement.customTickerHandler).toBeUndefined();
  });
});
