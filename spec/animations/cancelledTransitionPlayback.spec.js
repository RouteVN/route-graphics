import { Container, Texture } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { createAnimationBus } from "../../src/plugins/animations/animationBus.js";
import { containerPlugin } from "../../src/plugins/elements/container/index.js";
import { particlesPlugin } from "../../src/plugins/elements/particles/index.js";
import { renderElements } from "../../src/plugins/elements/renderElements.js";

// A real ticker stand-in: the particle runtime is only alive while its
// callback is registered here.
const createTicker = () => {
  const callbacks = new Set();
  return {
    callbacks,
    add: vi.fn((callback) => callbacks.add(callback)),
    remove: vi.fn((callback) => callbacks.delete(callback)),
    advance(deltaMS) {
      for (const callback of callbacks) callback({ deltaMS });
    },
  };
};

const createApp = () => ({
  renderer: {
    width: 640,
    height: 360,
    generateTexture: vi.fn(() => Texture.WHITE),
  },
  ticker: createTicker(),
});

const createTracker = () => ({
  getVersion: () => 1,
  track: vi.fn(),
  complete: vi.fn(),
  fail: vi.fn(),
});

const particles = {
  id: "weather-particles",
  type: "particles",
  x: 0,
  y: 0,
  width: 640,
  height: 360,
  count: 20,
  texture: { shape: "circle", radius: 2, color: "#ffffff" },
  behaviors: [],
  emitter: {
    lifetime: { min: 5, max: 5 },
    frequency: 0.05,
    maxParticles: 20,
    seed: 1,
  },
};

// The shape a host builds for a particle visual: a container that enters with
// a transition and wraps the particles element.
const weather = {
  id: "weather",
  type: "container",
  x: 0,
  y: 0,
  children: [particles],
};

const enterTransition = {
  id: "weather-enter",
  targetId: "weather",
  type: "transition",
  next: {
    tween: {
      alpha: {
        initialValue: 0,
        keyframes: [{ duration: 1000, value: 1, easing: "linear" }],
      },
    },
  },
};

const createStage = () => {
  const app = createApp();
  const parent = new Container();
  const animationBus = createAnimationBus();
  const completionTracker = createTracker();
  let prevTree = [];

  // Mirrors the order of a host render: animations the next state does not
  // continue are cancelled before the element tree is reconciled.
  const render = (nextTree, animations = []) => {
    animationBus.cancelAllExcept(new Set());
    const operation = renderElements({
      app,
      parent,
      prevComputedTree: prevTree,
      nextComputedTree: nextTree,
      animations,
      animationBus,
      completionTracker,
      eventHandler: vi.fn(),
      elementPlugins: [containerPlugin, particlesPlugin],
      signal: new AbortController().signal,
    });
    animationBus.flush();
    prevTree = nextTree;
    return operation;
  };

  const getParticles = () => parent.getChildByLabel(particles.id, true);
  const countAfter = (seconds) => {
    for (let elapsed = 0; elapsed < seconds * 1000; elapsed += 50) {
      app.ticker.advance(50);
    }
    return getParticles()?.emitter?.particleCount ?? 0;
  };

  return { app, parent, animationBus, render, getParticles, countAfter };
};

describe("playback of an element whose enter transition is cancelled", () => {
  it("starts the particles when the transition completes", () => {
    const stage = createStage();

    stage.render([weather], [enterTransition]);
    expect(stage.app.ticker.callbacks.size).toBe(0);

    stage.animationBus.tick(1000);

    expect(stage.app.ticker.callbacks.size).toBe(1);
    expect(stage.countAfter(1)).toBeGreaterThan(0);
  });

  it.each([0, 1, 16, 150, 500, 999])(
    "starts the particles when an unchanged render cancels the transition after %ims",
    (elapsedMS) => {
      const stage = createStage();

      stage.render([weather], [enterTransition]);
      if (elapsedMS > 0) stage.animationBus.tick(elapsedMS);
      stage.render([weather]);

      const mounted = stage.getParticles();
      expect(mounted).toBeTruthy();
      expect(mounted.destroyed).toBe(false);
      expect(mounted.parent.visible).toBe(true);
      expect(stage.app.ticker.callbacks.size).toBe(1);
      expect(stage.countAfter(1)).toBeGreaterThan(0);
    },
  );

  it("keeps the particles running through several quick unchanged renders", () => {
    const stage = createStage();

    stage.render([weather], [enterTransition]);
    stage.animationBus.tick(100);
    stage.render([weather]);
    stage.render([weather]);
    stage.render([weather]);

    expect(stage.app.ticker.callbacks.size).toBe(1);
    expect(stage.countAfter(1)).toBeGreaterThan(0);
  });

  it("starts a single runtime when the cancelling render also changes the particles", () => {
    const stage = createStage();

    stage.render([weather], [enterTransition]);
    stage.animationBus.tick(100);
    const cancelled = stage.getParticles();
    stage.render([
      {
        ...weather,
        children: [{ ...particles, count: 10 }],
      },
    ]);

    const mounted = stage.getParticles();
    expect(mounted).not.toBe(cancelled);
    expect(cancelled.destroyed).toBe(true);
    expect(stage.app.ticker.callbacks.size).toBe(1);
    expect(stage.countAfter(1)).toBeGreaterThan(0);
  });

  it("leaves no runtime behind when the cancelling render removes the element", () => {
    const stage = createStage();

    stage.render([weather], [enterTransition]);
    stage.animationBus.tick(100);
    const cancelled = stage.getParticles();
    stage.render([]);

    expect(stage.getParticles()).toBeNull();
    expect(cancelled.destroyed).toBe(true);
    expect(stage.app.ticker.callbacks.size).toBe(0);
  });

  it("leaves no runtime behind when the cancelling render replaces the element through another transition", () => {
    const stage = createStage();

    stage.render([weather], [enterTransition]);
    stage.animationBus.tick(100);
    stage.render([], [{ ...enterTransition, id: "weather-exit" }]);
    stage.animationBus.tick(1000);

    expect(stage.getParticles()).toBeNull();
    expect(stage.app.ticker.callbacks.size).toBe(0);
  });

  it("starts the particles when a cancelled enter is followed by a completed re-enter", () => {
    const stage = createStage();

    stage.render([weather], [enterTransition]);
    stage.animationBus.tick(100);
    stage.render([]);
    stage.render([weather], [{ ...enterTransition, id: "weather-enter-2" }]);
    stage.animationBus.tick(100);
    stage.render([weather]);

    expect(stage.app.ticker.callbacks.size).toBe(1);
    expect(stage.countAfter(1)).toBeGreaterThan(0);
  });
});
