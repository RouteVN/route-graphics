import {
  BlurFilter,
  Container,
  Graphics,
  Rectangle,
  RenderLayer,
  RenderTexture,
  Sprite,
} from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import {
  createSnapshotSubject,
  destroySubjectSnapshot,
} from "./transitionSurfaces.js";

const outer = (node) => ({
  x: node.x,
  y: node.y,
  scaleX: node.scale.x,
  scaleY: node.scale.y,
  pivotX: node.pivot.x,
  pivotY: node.pivot.y,
  skewX: node.skew.x,
  skewY: node.skew.y,
  rotation: node.rotation,
  alpha: node.alpha,
  blendMode: node.blendMode,
  isRenderGroup: node.isRenderGroup,
  isCachedAsTexture: node.isCachedAsTexture,
});
const setup = ({
  detached = false,
  group = false,
  cache = false,
  container = false,
} = {}) => {
  const parent = new Container({ isRenderGroup: true });
  const shape = new Graphics().rect(-3, -2, 20, 10).fill("red");
  const node = container ? new Container({ children: [shape] }) : shape;
  node.position.set(41, 29);
  node.scale.set(-1.5, 2);
  node.pivot.set(7, 5);
  node.skew.set(0.1, -0.2);
  node.rotation = 0.3;
  node.alpha = 0.25;
  node.blendMode = "add";
  if (group) node.enableRenderGroup();
  if (cache) node.cacheAsTexture({ resolution: 2 });
  const before = new Container(),
    after = new Container();
  parent.addChild(before, node, after);
  if (detached) parent.removeChild(node);
  const state = outer(node),
    order = [...parent.children],
    originalGroup = node.renderGroup;
  const restored = () => {
    expect(outer(node)).toEqual(state);
    expect(node.parent).toBe(detached ? null : parent);
    expect(parent.children).toEqual(order);
    expect(node.renderGroup).toBe(originalGroup);
    expect(node.destroyed).toBe(false);
  };
  return { parent, node, state, restored };
};

describe("transition snapshot staging lifecycle", () => {
  it.each([
    ["ordinary", {}],
    ["detached", { detached: true }],
    ["render group", { group: true }],
    ["cached", { cache: true }],
  ])("captures a %s object as a child and restores it", (_name, options) => {
    const { node, restored } = setup(options);
    const texture = RenderTexture.create({ width: 20, height: 10 });
    let staging;
    const app = {
      renderer: {
        generateTexture: vi.fn(({ target, frame }) => {
          staging = target;
          expect(target).not.toBe(node);
          expect(target.children).toEqual([node]);
          expect(node.parent).toBe(target);
          expect([node.x, node.y, node.rotation, node.alpha]).toEqual([
            0, 0, 0, 1,
          ]);
          expect([
            node.scale.x,
            node.scale.y,
            node.pivot.x,
            node.pivot.y,
            node.skew.x,
            node.skew.y,
          ]).toEqual([1, 1, 0, 0, 0, 0]);
          expect([frame.x, frame.y, frame.width, frame.height]).toEqual([
            -3, -2, 20, 10,
          ]);
          return texture;
        }),
      },
    };
    const subject = createSnapshotSubject(app, node);
    restored();
    expect(staging.destroyed).toBe(true);
    expect(subject.texture).toBe(texture);
    expect(subject.wrapper.children[0].position.x).toBe(-10);
    expect(subject.wrapper.children[0].position.y).toBe(-7);
    destroySubjectSnapshot(subject, app);
    expect(node.destroyed).toBe(false);
    expect(texture.destroyed).toBe(true);
  });

  it.each([false, true])(
    "restores a throwing renderer (detached: %s)",
    (detached) => {
      const { node, restored } = setup({ detached });
      const failure = new Error("capture failure");
      let staging;
      const app = {
        renderer: {
          generateTexture: ({ target }) => {
            staging = target;
            throw failure;
          },
        },
      };
      expect(() => createSnapshotSubject(app, node)).toThrow(failure);
      restored();
      expect(staging.destroyed).toBe(true);
    },
  );

  it.each(["added", "removed"])(
    "restores after a throwing initial %s listener",
    (event) => {
      const { node, restored } = setup();
      const failure = new Error(`${event} failure`);
      node.once(event, () => {
        throw failure;
      });
      const generateTexture = vi.fn();
      expect(() =>
        createSnapshotSubject({ renderer: { generateTexture } }, node),
      ).toThrow(failure);
      expect(generateTexture).not.toHaveBeenCalled();
      restored();
    },
  );

  it.each(["added", "removed"])(
    "finishes rollback after a throwing restoration %s listener",
    (event) => {
      const { node, restored } = setup();
      const failure = new Error("restore failure");
      const texture = RenderTexture.create({ width: 20, height: 10 });
      let staging;
      const app = {
        renderer: {
          generateTexture: ({ target }) => {
            staging = target;
            node.once(event, () => {
              throw failure;
            });
            return texture;
          },
        },
      };
      expect(() => createSnapshotSubject(app, node)).toThrow(failure);
      restored();
      expect(staging.destroyed).toBe(true);
      expect(texture.destroyed).toBe(true);
    },
  );

  it("retains both capture and restoration failures without abandoning cleanup", () => {
    const { node, restored } = setup();
    const captureFailure = new Error("capture failure"),
      restoreFailure = new Error("restore failure");
    let staging, thrown;
    const app = {
      renderer: {
        generateTexture: ({ target }) => {
          staging = target;
          node.once("added", () => {
            throw restoreFailure;
          });
          throw captureFailure;
        },
      },
    };
    try {
      createSnapshotSubject(app, node);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(AggregateError);
    expect(thrown.errors).toEqual([captureFailure, restoreFailure]);
    restored();
    expect(staging.destroyed).toBe(true);
  });

  it("uses observable public reparent events with restored transforms", () => {
    const { parent, node, state, restored } = setup();
    const events = [];
    for (const name of ["added", "removed"])
      node.on(name, (owner) => {
        events.push({ name, originalParent: owner === parent });
        expect(outer(node)).toEqual(state);
      });
    const texture = RenderTexture.create({ width: 20, height: 10 });
    const app = { renderer: { generateTexture: () => texture } };
    const subject = createSnapshotSubject(app, node);
    expect(events).toEqual([
      { name: "removed", originalParent: true },
      { name: "added", originalParent: false },
      { name: "removed", originalParent: false },
      { name: "added", originalParent: true },
    ]);
    restored();
    destroySubjectSnapshot(subject, app);
  });

  it.each([false, true])(
    "preserves filter, mask and blend ownership (throw: %s)",
    (throws) => {
      const { node, restored } = setup({ container: true });
      const mask = new Graphics().rect(0, 0, 10, 10).fill("white");
      node.addChild(mask);
      const filter = new BlurFilter({ strength: 2 });
      node.mask = mask;
      node.filters = [filter];
      node.filterArea = new Rectangle(0, 0, 30, 20);
      const filters = node.filters,
        area = node.filterArea;
      const texture = RenderTexture.create({ width: 20, height: 10 });
      const app = {
        renderer: {
          generateTexture: () => {
            expect(node.mask).toBe(mask);
            expect(node.filters).toBe(filters);
            expect(node.filterArea).toBe(area);
            expect(node.blendMode).toBe("add");
            if (throws) throw new Error("capture failure");
            return texture;
          },
        },
      };
      if (throws)
        expect(() => createSnapshotSubject(app, node)).toThrow(
          "capture failure",
        );
      else destroySubjectSnapshot(createSnapshotSubject(app, node), app);
      restored();
      expect(node.mask).toBe(mask);
      expect(node.filters).toBe(filters);
      expect(node.filterArea).toBe(area);
      expect(mask.destroyed).toBe(false);
      expect(filter.destroyed).not.toBe(true);
      node.mask = null;
      node.filters = [];
      mask.destroy();
      filter.destroy();
      texture.destroy(true);
    },
  );

  it.each(["success", "detached", "renderer", "listener"])(
    "restores render-layer order after %s",
    (mode) => {
      const { node, restored } = setup({ detached: mode === "detached" });
      const sortFunction = () => 0;
      const layer = new RenderLayer({ sortableChildren: false, sortFunction });
      const prefix = new Container(),
        first = new Container(),
        last = new Container();
      layer.attach(prefix, node, first, last);
      const order = [...layer.renderLayerChildren];
      const texture = RenderTexture.create({ width: 20, height: 10 });
      const failure = new Error("capture failure");
      const app = {
        renderer: {
          generateTexture: () => {
            expect(node.parentRenderLayer).toBe(null);
            if (mode === "renderer") throw failure;
            if (mode === "listener")
              node.once("added", () => {
                throw failure;
              });
            return texture;
          },
        },
      };
      if (mode === "success" || mode === "detached")
        destroySubjectSnapshot(createSnapshotSubject(app, node), app);
      else expect(() => createSnapshotSubject(app, node)).toThrow(failure);
      restored();
      expect(node.parentRenderLayer).toBe(layer);
      expect(layer.renderLayerChildren).toEqual(order);
      expect(layer.sortableChildren).toBe(false);
      expect(layer.sortFunction).toBe(sortFunction);
      expect(prefix.destroyed || first.destroyed || last.destroyed).toBe(false);
      texture.destroy(true);
    },
  );

  it("reports reentrant layer changes without replacing the caller's order", () => {
    const { node, restored } = setup();
    const layer = new RenderLayer(),
      before = new Container(),
      after = new Container();
    layer.attach(before, node, after);
    const texture = RenderTexture.create({ width: 20, height: 10 });
    const app = {
      renderer: {
        generateTexture: () => {
          node.once("added", () => {
            layer.detach(before);
            layer.attach(before);
          });
          return texture;
        },
      },
    };
    expect(() => createSnapshotSubject(app, node)).toThrow(
      "Snapshot render-layer membership changed during capture",
    );
    restored();
    expect(layer.renderLayerChildren).toEqual([after, before]);
    expect(texture.destroyed).toBe(true);
  });

  it("leaves an unfiltered borrowed sprite attached and does not own its texture", () => {
    const texture = RenderTexture.create({ width: 20, height: 10 });
    const sprite = new Sprite(texture),
      parent = new Container();
    parent.addChild(sprite);
    const removed = vi.fn();
    sprite.on("removed", removed);
    const generateTexture = vi.fn(),
      app = { renderer: { generateTexture } };
    const subject = createSnapshotSubject(app, sprite);
    expect(subject.texture).toBe(texture);
    expect(subject.ownsTexture).toBe(false);
    expect(generateTexture).not.toHaveBeenCalled();
    expect(removed).not.toHaveBeenCalled();
    expect(sprite.parent).toBe(parent);
    destroySubjectSnapshot(subject, app);
    expect(texture.destroyed).toBe(false);
    parent.destroy({ children: true });
    texture.destroy(true);
  });
});
