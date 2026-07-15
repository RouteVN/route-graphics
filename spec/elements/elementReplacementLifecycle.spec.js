import { Container, Texture } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import { createAnimationBus } from "../../src/plugins/animations/animationBus.js";
import { renderElements } from "../../src/plugins/elements/renderElements.js";
import { createCompletionTracker } from "../../src/util/completionTracker.js";

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
};

const createTrackerStub = () => ({
  getVersion: () => 0,
  track: vi.fn(),
  complete: vi.fn(),
});

const findDirectChild = (parent, id) =>
  parent.children.find((child) => child.label === id) ?? null;

const createChildPlugin = ({
  type,
  add: addElement,
  delete: deleteElement,
  onAdd,
} = {}) => ({
  type,
  add: vi.fn(
    addElement ??
      ((options) => {
        const child = new Container({ label: options.element.id });
        child.mountedType = type;
        options.parent.addChild(child);
        onAdd?.(options);
      }),
  ),
  update: vi.fn(),
  delete: vi.fn(
    deleteElement ??
      (({ parent, element }) => {
        const child = findDirectChild(parent, element.id);
        if (!child) return;
        parent.removeChild(child);
        child.destroy();
      }),
  ),
});

const createOwnerPlugin = ({
  getContentLabel = (id) => `${id}-content`,
  getRebuiltContentLabel = getContentLabel,
  keepPreviousContent = false,
} = {}) => ({
  type: "owner",
  add: vi.fn((options) => {
    const owner = new Container({ label: options.element.id });
    const content = new Container({
      label: getContentLabel(options.element.id),
    });
    owner.addChild(content);
    options.parent.addChild(owner);

    return renderElements({
      ...options,
      parent: content,
      prevComputedTree: [],
      nextComputedTree: options.element.children,
    });
  }),
  update: vi.fn((options) => {
    const owner = findDirectChild(options.parent, options.prevElement.id);
    let content = findDirectChild(
      owner,
      getContentLabel(options.prevElement.id),
    );

    if (options.nextElement.rebuildParent) {
      const rebuiltContent = new Container({
        label: getRebuiltContentLabel(options.nextElement.id),
      });
      for (const child of [...content.children]) {
        rebuiltContent.addChild(child);
      }
      if (!keepPreviousContent) {
        owner.removeChild(content);
        content.destroy({ children: false });
      }
      owner.addChild(rebuiltContent);
      content = rebuiltContent;
    }

    const childrenChanged =
      JSON.stringify(options.prevElement.children) !==
      JSON.stringify(options.nextElement.children);
    if (!childrenChanged) {
      return undefined;
    }

    return renderElements({
      ...options,
      parent: content,
      prevComputedTree: options.prevElement.children,
      nextComputedTree: options.nextElement.children,
    });
  }),
  delete: vi.fn(({ parent, element }) => {
    const owner = findDirectChild(parent, element.id);
    if (!owner) return;
    parent.removeChild(owner);
    owner.destroy({ children: true });
  }),
});

const createOwnerElement = ({
  child,
  rebuildParent = false,
  revision = 0,
}) => ({
  id: "group",
  type: "owner",
  rebuildParent,
  revision,
  children: [child],
});

const createChildElement = (type, extra = {}) => ({
  id: "background",
  type,
  ...extra,
});

const render = ({
  app,
  parent,
  prev,
  next,
  plugins,
  completionTracker = createTrackerStub(),
  animations = [],
  animationBus = { dispatch: vi.fn() },
  signal = new AbortController().signal,
}) =>
  renderElements({
    app,
    parent,
    prevComputedTree: prev,
    nextComputedTree: next,
    animations,
    animationBus,
    completionTracker,
    eventHandler: vi.fn(),
    elementPlugins: plugins,
    signal,
  });

describe("element replacement lifecycle", () => {
  it("reserves completion and presentation for an asynchronous replacement add", async () => {
    const root = new Container();
    const app = { render: vi.fn() };
    const mounting = createDeferred();
    const eventHandler = vi.fn();
    const completionTracker = createCompletionTracker(eventHandler);
    let completeAnimation;
    const previousPlugin = createChildPlugin({ type: "previous" });
    const nextPlugin = createChildPlugin({
      type: "next",
      add: (options) =>
        mounting.promise.then(() => {
          const child = new Container({ label: options.element.id });
          child.mountedType = "next";
          options.parent.addChild(child);

          const version = options.completionTracker.getVersion();
          options.completionTracker.track(version);
          completeAnimation = () => options.completionTracker.complete(version);
        }),
    });
    const plugins = [previousPlugin, nextPlugin];
    const previous = createChildElement("previous");
    const next = createChildElement("next");

    completionTracker.reset("initial");
    render({
      app,
      parent: root,
      prev: [],
      next: [previous],
      plugins,
      completionTracker,
    });
    completionTracker.completeIfEmpty();
    eventHandler.mockClear();
    app.render.mockClear();

    completionTracker.reset("replacement");
    const replacementOperation = render({
      app,
      parent: root,
      prev: [previous],
      next: [next],
      plugins,
      completionTracker,
    });
    completionTracker.completeIfEmpty();

    expect(eventHandler).not.toHaveBeenCalled();
    expect(app.render).not.toHaveBeenCalled();

    mounting.resolve();
    await replacementOperation;

    expect(eventHandler).not.toHaveBeenCalled();
    expect(app.render).toHaveBeenCalledTimes(1);

    completeAnimation();
    expect(eventHandler).toHaveBeenCalledWith("renderComplete", {
      id: "replacement",
      aborted: false,
    });
  });

  it("reconciles an async add through its live plugin after supersession", async () => {
    const root = new Container();
    const app = { render: vi.fn() };
    const mounting = createDeferred();
    const previousPlugin = createChildPlugin({ type: "previous" });
    const deferredPlugin = createChildPlugin({
      type: "deferred",
      add: ({ parent, element }) =>
        mounting.promise.then(() => {
          const child = new Container({ label: element.id });
          child.mountedType = "deferred";
          parent.addChild(child);
        }),
    });
    const latestPlugin = createChildPlugin({ type: "latest" });
    const plugins = [previousPlugin, deferredPlugin, latestPlugin];
    const previous = createChildElement("previous");
    const deferred = createChildElement("deferred");
    const latest = createChildElement("latest");

    render({ app, parent: root, prev: [], next: [previous], plugins });
    const firstController = new AbortController();
    const replacementOperation = render({
      app,
      parent: root,
      prev: [previous],
      next: [deferred],
      plugins,
      signal: firstController.signal,
    });

    firstController.abort();
    render({
      app,
      parent: root,
      prev: [deferred],
      next: [latest],
      plugins,
    });

    mounting.resolve();
    await replacementOperation;

    expect(deferredPlugin.delete).toHaveBeenCalledTimes(1);
    expect(latestPlugin.add).toHaveBeenCalledTimes(1);
    expect(findDirectChild(root, "background")?.mountedType).toBe("latest");
    expect(
      root.children.filter((child) => child.label === "background"),
    ).toHaveLength(1);
  });

  it("keeps a deferred replacement in a custom composite render slot", async () => {
    const root = new Container();
    const app = { render: vi.fn() };
    const deletion = createDeferred();
    const ownerPlugin = createOwnerPlugin({
      getContentLabel: () => "arbitrary-layout-slot",
    });
    const previousPlugin = createChildPlugin({
      type: "previous",
      delete: ({ parent, element }) =>
        deletion.promise.then(() => {
          const child = findDirectChild(parent, element.id);
          if (!child) return;
          parent.removeChild(child);
          child.destroy();
        }),
    });
    const nextPlugin = createChildPlugin({ type: "next" });
    const plugins = [ownerPlugin, previousPlugin, nextPlugin];
    const initialOwner = createOwnerElement({
      child: createChildElement("previous"),
    });
    const replacementOwner = createOwnerElement({
      child: createChildElement("next"),
    });

    render({ app, parent: root, prev: [], next: [initialOwner], plugins });
    const replacementOperation = render({
      app,
      parent: root,
      prev: [initialOwner],
      next: [replacementOwner],
      plugins,
    });

    deletion.resolve();
    await replacementOperation;

    const owner = findDirectChild(root, "group");
    const slot = findDirectChild(owner, "arbitrary-layout-slot");
    expect(findDirectChild(slot, "background")?.mountedType).toBe("next");
    expect(findDirectChild(owner, "background")).toBeNull();
  });

  it("retargets a pending persistent transition after its owner rebuilds", async () => {
    const root = new Container();
    const app = {
      render: vi.fn(),
      renderer: {
        width: 1280,
        height: 720,
        generateTexture: vi.fn(() => Texture.EMPTY),
      },
    };
    const deletion = createDeferred();
    const animationBus = createAnimationBus();
    const ownerPlugin = createOwnerPlugin();
    const previousPlugin = createChildPlugin({
      type: "previous",
      delete: ({ parent, element }) =>
        deletion.promise.then(() => {
          const child = findDirectChild(parent, element.id);
          if (!child) return;
          parent.removeChild(child);
          child.destroy();
        }),
    });
    const nextPlugin = createChildPlugin({ type: "next" });
    const plugins = [ownerPlugin, previousPlugin, nextPlugin];
    const initialOwner = createOwnerElement({
      child: createChildElement("previous"),
    });
    const replacementOwner = createOwnerElement({
      child: createChildElement("next"),
    });
    const transition = {
      id: "background-transition",
      targetId: "background",
      type: "transition",
      playback: { continuity: "persistent" },
      prev: {
        tween: {
          alpha: {
            initialValue: 1,
            keyframes: [{ duration: 300, value: 0, easing: "linear" }],
          },
        },
      },
      next: {
        tween: {
          alpha: {
            initialValue: 0,
            keyframes: [{ duration: 300, value: 1, easing: "linear" }],
          },
        },
      },
    };

    render({ app, parent: root, prev: [], next: [initialOwner], plugins });
    const replacementOperation = render({
      app,
      parent: root,
      prev: [initialOwner],
      next: [replacementOwner],
      plugins,
      animations: [transition],
      animationBus,
    });

    const rebuiltOwner = createOwnerElement({
      child: createChildElement("next"),
      rebuildParent: true,
      revision: 1,
    });
    render({
      app,
      parent: root,
      prev: [replacementOwner],
      next: [rebuiltOwner],
      plugins,
      animations: [transition],
      animationBus,
    });

    deletion.resolve();
    await replacementOperation;

    expect(previousPlugin.delete).toHaveBeenCalledTimes(2);
    expect(animationBus.getState().activeCount).toBe(1);

    animationBus.tick(300);

    const owner = findDirectChild(root, "group");
    const content = findDirectChild(owner, "group-content");
    expect(findDirectChild(content, "background")?.mountedType).toBe("next");
    expect(
      content.children.filter((child) => child.label === "background"),
    ).toHaveLength(1);
    expect(animationBus.getState().activeCount).toBe(0);
  });

  it("preserves the live plugin marker after a render parent is rebuilt", () => {
    const root = new Container();
    const app = { render: vi.fn() };
    const ownerPlugin = createOwnerPlugin();
    const livePlugin = createChildPlugin({ type: "live-a" });
    const committedPlugin = createChildPlugin({ type: "committed-b" });
    const desiredPlugin = createChildPlugin({ type: "desired-c" });
    const plugins = [ownerPlugin, livePlugin, committedPlugin, desiredPlugin];
    const liveOwner = createOwnerElement({
      child: createChildElement("live-a"),
    });

    render({ app, parent: root, prev: [], next: [liveOwner], plugins });

    const committedOwner = createOwnerElement({
      child: createChildElement("committed-b"),
    });
    const desiredOwner = createOwnerElement({
      child: createChildElement("desired-c"),
      rebuildParent: true,
      revision: 1,
    });

    render({
      app,
      parent: root,
      prev: [committedOwner],
      next: [desiredOwner],
      plugins,
    });

    expect(livePlugin.delete).toHaveBeenCalledTimes(1);
    expect(committedPlugin.delete).not.toHaveBeenCalled();
    expect(desiredPlugin.add).toHaveBeenCalledTimes(1);
  });

  it("retargets pending cleanup and mount after a render parent rebuild", async () => {
    const root = new Container();
    const app = { render: vi.fn() };
    const deletion = createDeferred();
    const ownerPlugin = createOwnerPlugin();
    const previousPlugin = createChildPlugin({
      type: "previous",
      delete: ({ parent, element }) =>
        deletion.promise.then(() => {
          const child = findDirectChild(parent, element.id);
          if (!child) return;
          parent.removeChild(child);
          child.destroy();
        }),
    });
    const nextPlugin = createChildPlugin({ type: "next" });
    const plugins = [ownerPlugin, previousPlugin, nextPlugin];
    const initialOwner = createOwnerElement({
      child: createChildElement("previous"),
    });
    const replacementOwner = createOwnerElement({
      child: createChildElement("next"),
    });

    render({ app, parent: root, prev: [], next: [initialOwner], plugins });
    const replacementOperation = render({
      app,
      parent: root,
      prev: [initialOwner],
      next: [replacementOwner],
      plugins,
    });

    const rebuiltOwner = createOwnerElement({
      child: createChildElement("next"),
      rebuildParent: true,
      revision: 1,
    });
    render({
      app,
      parent: root,
      prev: [replacementOwner],
      next: [rebuiltOwner],
      plugins,
    });

    deletion.resolve();
    await replacementOperation;

    const owner = findDirectChild(root, "group");
    const currentContent = findDirectChild(owner, "group-content");
    expect(findDirectChild(currentContent, "background")?.mountedType).toBe(
      "next",
    );
    expect(previousPlugin.delete).toHaveBeenCalledTimes(2);
    expect(nextPlugin.add).toHaveBeenCalledTimes(1);
  });

  it("follows a live child when a custom composite keeps its old slot", async () => {
    const root = new Container();
    const app = { render: vi.fn() };
    const deletion = createDeferred();
    const ownerPlugin = createOwnerPlugin({
      getContentLabel: () => "layout-slot-a",
      getRebuiltContentLabel: () => "layout-slot-b",
      keepPreviousContent: true,
    });
    const previousPlugin = createChildPlugin({
      type: "previous",
      delete: ({ parent, element }) =>
        deletion.promise.then(() => {
          const child = findDirectChild(parent, element.id);
          if (!child) return;
          parent.removeChild(child);
          child.destroy();
        }),
    });
    const nextPlugin = createChildPlugin({ type: "next" });
    const plugins = [ownerPlugin, previousPlugin, nextPlugin];
    const initialOwner = createOwnerElement({
      child: createChildElement("previous"),
    });
    const replacementOwner = createOwnerElement({
      child: createChildElement("next"),
    });

    render({ app, parent: root, prev: [], next: [initialOwner], plugins });
    const replacementOperation = render({
      app,
      parent: root,
      prev: [initialOwner],
      next: [replacementOwner],
      plugins,
    });

    const rebuiltOwner = createOwnerElement({
      child: createChildElement("next"),
      rebuildParent: true,
      revision: 1,
    });
    render({
      app,
      parent: root,
      prev: [replacementOwner],
      next: [rebuiltOwner],
      plugins,
    });

    deletion.resolve();
    await replacementOperation;

    const owner = findDirectChild(root, "group");
    const oldSlot = findDirectChild(owner, "layout-slot-a");
    const currentSlot = findDirectChild(owner, "layout-slot-b");
    expect(findDirectChild(oldSlot, "background")).toBeNull();
    expect(findDirectChild(currentSlot, "background")?.mountedType).toBe(
      "next",
    );
    expect(previousPlugin.delete).toHaveBeenCalledTimes(2);
    expect(nextPlugin.add).toHaveBeenCalledTimes(1);
  });

  it("reserves render completion while cleanup and mounted animation are pending", async () => {
    const root = new Container();
    const app = { render: vi.fn() };
    const deletion = createDeferred();
    const eventHandler = vi.fn();
    const completionTracker = createCompletionTracker(eventHandler);
    let completeAnimation;
    const previousPlugin = createChildPlugin({
      type: "previous",
      delete: ({ parent, element }) =>
        deletion.promise.then(() => {
          const child = findDirectChild(parent, element.id);
          if (!child) return;
          parent.removeChild(child);
          child.destroy();
        }),
    });
    const nextPlugin = createChildPlugin({
      type: "next",
      onAdd: ({ animations, completionTracker: tracker }) => {
        expect(animations.has("background")).toBe(true);
        const version = tracker.getVersion();
        tracker.track(version);
        completeAnimation = () => tracker.complete(version);
      },
    });
    const plugins = [previousPlugin, nextPlugin];
    const previous = createChildElement("previous");
    const next = createChildElement("next");

    completionTracker.reset("initial");
    render({
      app,
      parent: root,
      prev: [],
      next: [previous],
      plugins,
      completionTracker,
    });
    completionTracker.completeIfEmpty();
    eventHandler.mockClear();

    completionTracker.reset("replacement");
    const replacementOperation = render({
      app,
      parent: root,
      prev: [previous],
      next: [next],
      plugins,
      completionTracker,
      animations: [
        {
          id: "background-update",
          targetId: "background",
          type: "update",
        },
      ],
    });
    completionTracker.completeIfEmpty();

    expect(eventHandler).not.toHaveBeenCalled();

    deletion.resolve();
    await replacementOperation;
    expect(eventHandler).not.toHaveBeenCalled();

    completeAnimation();
    expect(eventHandler).toHaveBeenCalledOnce();
    expect(eventHandler).toHaveBeenCalledWith("renderComplete", {
      id: "replacement",
      aborted: false,
    });
  });

  it("requests a frame after a deferred replacement mounts", async () => {
    const root = new Container();
    const app = { render: vi.fn() };
    const deletion = createDeferred();
    const previousPlugin = createChildPlugin({
      type: "previous",
      delete: ({ parent, element }) =>
        deletion.promise.then(() => {
          const child = findDirectChild(parent, element.id);
          if (!child) return;
          parent.removeChild(child);
          child.destroy();
        }),
    });
    const nextPlugin = createChildPlugin({ type: "next" });
    const plugins = [previousPlugin, nextPlugin];
    const previous = createChildElement("previous");
    const next = createChildElement("next");

    render({ app, parent: root, prev: [], next: [previous], plugins });
    app.render.mockClear();
    const replacementOperation = render({
      app,
      parent: root,
      prev: [previous],
      next: [next],
      plugins,
    });

    deletion.resolve();
    await replacementOperation;

    expect(nextPlugin.add).toHaveBeenCalledTimes(1);
    expect(app.render).toHaveBeenCalledTimes(1);
  });

  it("requests a frame when the latest render removes a pending replacement", async () => {
    const root = new Container();
    const app = { render: vi.fn() };
    const deletion = createDeferred();
    const previousPlugin = createChildPlugin({
      type: "previous",
      delete: ({ parent, element }) =>
        deletion.promise.then(() => {
          const child = findDirectChild(parent, element.id);
          if (!child) return;
          parent.removeChild(child);
          child.destroy();
        }),
    });
    const nextPlugin = createChildPlugin({ type: "next" });
    const plugins = [previousPlugin, nextPlugin];
    const previous = createChildElement("previous");
    const next = createChildElement("next");

    render({ app, parent: root, prev: [], next: [previous], plugins });
    app.render.mockClear();
    const firstController = new AbortController();
    const replacementOperation = render({
      app,
      parent: root,
      prev: [previous],
      next: [next],
      plugins,
      signal: firstController.signal,
    });

    firstController.abort();
    render({
      app,
      parent: root,
      prev: [next],
      next: [],
      plugins,
    });

    deletion.resolve();
    await replacementOperation;

    expect(nextPlugin.add).not.toHaveBeenCalled();
    expect(findDirectChild(root, "background")).toBeNull();
    expect(app.render).toHaveBeenCalledTimes(1);
  });
});
