import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
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

const createChildPlugin = ({ type, delete: deleteElement, onAdd } = {}) => ({
  type,
  add: vi.fn((options) => {
    const child = new Container({ label: options.element.id });
    child.mountedType = type;
    options.parent.addChild(child);
    onAdd?.(options);
  }),
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

const createOwnerPlugin = () => ({
  type: "owner",
  add: vi.fn((options) => {
    const owner = new Container({ label: options.element.id });
    const content = new Container({
      label: `${options.element.id}-content`,
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
    let content = findDirectChild(owner, `${options.prevElement.id}-content`);

    if (options.nextElement.rebuildParent) {
      const rebuiltContent = new Container({
        label: `${options.nextElement.id}-content`,
      });
      for (const child of [...content.children]) {
        rebuiltContent.addChild(child);
      }
      owner.removeChild(content);
      content.destroy({ children: false });
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
  signal = new AbortController().signal,
}) =>
  renderElements({
    app,
    parent,
    prevComputedTree: prev,
    nextComputedTree: next,
    animations,
    animationBus: { dispatch: vi.fn() },
    completionTracker,
    eventHandler: vi.fn(),
    elementPlugins: plugins,
    signal,
  });

describe("element replacement lifecycle", () => {
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
