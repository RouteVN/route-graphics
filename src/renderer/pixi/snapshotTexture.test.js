import { Container, Graphics, Rectangle, RenderTexture } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import { extractSnapshot, generateSnapshotTexture } from "./snapshotTexture.js";

const fixture = ({ group = false, detached = false } = {}) => {
  const parent = new Container();
  parent.alpha = 0;
  const node = new Graphics().rect(0, 0, 12, 8).fill("red");
  node.position.set(23, 17);
  node.pivot.set(3, 2);
  node.scale.set(0, -2);
  node.rotation = 0.4;
  node.alpha = 0.5;
  if (group) node.enableRenderGroup();
  const before = new Container(),
    after = new Container();
  parent.addChild(before, node, after);
  if (detached) parent.removeChild(node);
  const owner = node.renderGroup;
  const check = () => {
    expect(node.parent).toBe(detached ? null : parent);
    expect(parent.children).toEqual(
      detached ? [before, after] : [before, node, after],
    );
    expect([
      node.x,
      node.y,
      node.pivot.x,
      node.pivot.y,
      node.scale.x,
      node.scale.y,
      node.rotation,
      node.alpha,
    ]).toEqual([23, 17, 3, 2, 0, -2, 0.4, 0.5]);
    expect(node.renderGroup).toBe(owner);
    expect(node.destroyed).toBe(false);
  };
  return { node, check, frame: new Rectangle(0, 0, 160, 100) };
};

describe("shared snapshot texture owner", () => {
  it.each([
    ["ordinary", {}],
    ["existing group", { group: true }],
    ["detached", { detached: true }],
  ])(
    "preserves selected own alpha, not ancestor alpha, for %s",
    (_name, options) => {
      const { node, frame, check } = fixture(options);
      const texture = RenderTexture.create({ width: 160, height: 100 });
      let wrapper;
      const renderer = {
        generateTexture: vi.fn(({ target, frame: actualFrame }) => {
          wrapper = target;
          expect(target.children).toEqual([node]);
          expect(target.alpha).toBe(0.5);
          expect(node.alpha).toBe(1);
          expect([
            node.x,
            node.y,
            node.pivot.x,
            node.pivot.y,
            node.scale.x,
            node.scale.y,
            node.rotation,
          ]).toEqual([0, 0, 0, 0, 1, 1, 0]);
          expect(actualFrame).toBe(frame);
          return texture;
        }),
      };
      expect(
        generateSnapshotTexture({
          renderer,
          displayObject: node,
          frame,
          preserveAlpha: true,
        }),
      ).toBe(texture);
      check();
      expect(wrapper.destroyed).toBe(true);
      texture.destroy(true);
    },
  );

  it("retains existing transition-neutral alpha by default", () => {
    const { node, frame, check } = fixture();
    const texture = RenderTexture.create({ width: 160, height: 100 });
    const renderer = {
      generateTexture: () => {
        expect(node.alpha).toBe(1);
        return texture;
      },
    };
    generateSnapshotTexture({ renderer, displayObject: node, frame });
    check();
    texture.destroy(true);
  });

  it("restores every live field and parent after renderer failure", () => {
    const { node, frame, check } = fixture({ group: true });
    const error = Error("renderer failed");
    const renderer = {
      generateTexture: () => {
        throw error;
      },
    };
    expect(() =>
      generateSnapshotTexture({
        renderer,
        displayObject: node,
        frame,
        preserveAlpha: true,
      }),
    ).toThrow(error);
    check();
  });

  describe.each(["base64", "canvas"])("%s extraction", (format) => {
    it("restores before awaiting encoding and releases only generated texture", async () => {
      const { node, frame, check } = fixture();
      const texture = RenderTexture.create({ width: 160, height: 100 });
      const destroy = vi.spyOn(texture, "destroy");
      let resolve;
      const renderer = {
        generateTexture: () => texture,
        extract: {
          [format]: vi.fn(({ target }) => {
            check();
            expect(target).toBe(texture);
            return new Promise((done) => {
              resolve = done;
            });
          }),
        },
      };
      const pending = extractSnapshot({
        renderer,
        format,
        displayObject: node,
        frame,
      });
      check();
      expect(destroy).not.toHaveBeenCalled();
      resolve("data:image/png;base64,example");
      await expect(pending).resolves.toBe("data:image/png;base64,example");
      expect(destroy).toHaveBeenCalledExactlyOnceWith(true);
      check();
    });

    it("releases generated texture on asynchronous encoding rejection", async () => {
      const { node, frame, check } = fixture();
      const texture = RenderTexture.create({ width: 160, height: 100 });
      const destroy = vi.spyOn(texture, "destroy");
      const error = Error("encoding failed");
      const renderer = {
        generateTexture: () => texture,
        extract: {
          [format]: async () => {
            throw error;
          },
        },
      };
      await expect(
        extractSnapshot({ renderer, displayObject: node, frame, format }),
      ).rejects.toBe(error);
      expect(destroy).toHaveBeenCalledExactlyOnceWith(true);
      check();
    });

    it("keeps encoding and cleanup errors without losing original ownership", async () => {
      const { node, frame, check } = fixture();
      const encode = Error("encode"),
        cleanup = Error("cleanup");
      const renderer = {
        generateTexture: () => ({
          destroy: () => {
            throw cleanup;
          },
        }),
        extract: {
          [format]: async () => {
            throw encode;
          },
        },
      };
      const error = await extractSnapshot({
        renderer,
        format,
        displayObject: node,
        frame,
      }).catch((value) => value);
      expect(error).toBeInstanceOf(AggregateError);
      expect(error.errors).toEqual([encode, cleanup]);
      check();
    });

    it("releases generated texture after synchronous extraction failure", async () => {
      const { node, frame, check } = fixture();
      const texture = RenderTexture.create({ width: 160, height: 100 });
      const destroy = vi.spyOn(texture, "destroy");
      const error = Error("extract failed");
      const renderer = {
        generateTexture: () => texture,
        extract: {
          [format]: () => {
            throw error;
          },
        },
      };
      await expect(
        extractSnapshot({ renderer, displayObject: node, frame, format }),
      ).rejects.toBe(error);
      expect(destroy).toHaveBeenCalledExactlyOnceWith(true);
      check();
    });

    it("reports cleanup failure after successful extraction", async () => {
      const { node, frame, check } = fixture();
      const error = Error("cleanup failed");
      const renderer = {
        generateTexture: () => ({
          destroy: () => {
            throw error;
          },
        }),
        extract: { [format]: () => "result" },
      };
      await expect(
        extractSnapshot({ renderer, displayObject: node, frame, format }),
      ).rejects.toBe(error);
      check();
    });
  });

  it("restores after observable added listener failure without destroying source", () => {
    const { node, frame, check } = fixture();
    const error = Error("added listener");
    node.once("added", () => {
      throw error;
    });
    const generateTexture = vi.fn();
    expect(() =>
      generateSnapshotTexture({
        renderer: { generateTexture },
        displayObject: node,
        frame,
        preserveAlpha: true,
      }),
    ).toThrow(error);
    expect(generateTexture).not.toHaveBeenCalled();
    check();
  });
});
