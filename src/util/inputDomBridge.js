const DEFAULT_HIDDEN_OPACITY = "0";

const getSelectionValue = (element, key) => {
  const value = element?.[key];

  return typeof value === "number" ? value : 0;
};

const getSnapshot = (entry) => ({
  value: entry.element.value ?? "",
  selectionStart: getSelectionValue(entry.element, "selectionStart"),
  selectionEnd: getSelectionValue(entry.element, "selectionEnd"),
  focused: document.activeElement === entry.element,
  composing: entry.composing === true,
});

const isSnapshotEqual = (left, right) => {
  if (!left || !right) return false;

  return (
    left.value === right.value &&
    left.selectionStart === right.selectionStart &&
    left.selectionEnd === right.selectionEnd &&
    left.focused === right.focused &&
    left.composing === right.composing
  );
};

const isTextControlTarget = (target) =>
  target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

const applyPointerInteractivity = (entry) => {
  entry.element.style.pointerEvents = "none";
};

const setSelection = (element, start, end) => {
  if (typeof element?.setSelectionRange !== "function") {
    return;
  }

  try {
    element.setSelectionRange(start, end);
  } catch {
    // Browser selection APIs are inconsistent across input types.
  }
};

const isPointerWithinEntryGeometry = ({ app, entry, event }) => {
  const geometry = entry.options.getGeometry?.();
  const canvas = app.canvas;

  if (!geometry || !canvas) {
    return false;
  }

  const canvasRect = canvas.getBoundingClientRect();
  const rendererWidth = app.renderer?.width || canvasRect.width || 1;
  const rendererHeight = app.renderer?.height || canvasRect.height || 1;
  const scaleX = canvasRect.width / rendererWidth;
  const scaleY = canvasRect.height / rendererHeight;
  const left = canvasRect.left + geometry.x * scaleX;
  const top = canvasRect.top + geometry.y * scaleY;
  const right = left + geometry.width * scaleX;
  const bottom = top + geometry.height * scaleY;
  const clientX = event.clientX;
  const clientY = event.clientY;

  return (
    Number.isFinite(clientX) &&
    Number.isFinite(clientY) &&
    clientX >= left &&
    clientX <= right &&
    clientY >= top &&
    clientY <= bottom
  );
};

export const createInputDomBridge = ({ app }) => {
  const entries = new Map();
  let root;
  let activeId = null;

  const ensureRoot = () => {
    if (!root) {
      root = document.createElement("div");
      root.dataset.routeGraphicsInputBridge = "true";
      root.style.position = "fixed";
      root.style.left = "0";
      root.style.top = "0";
      root.style.pointerEvents = "none";
      root.style.zIndex = "1000";
      root.style.width = "0";
      root.style.height = "0";
    }

    const host = app.canvas?.parentNode ?? document.body;

    if (!root.isConnected) {
      host.appendChild(root);
    }
  };

  const notifySnapshot = (entry, previousSnapshot = entry.lastSnapshot) => {
    const snapshot = getSnapshot(entry);

    if (snapshot.focused && activeId !== entry.id) {
      activeId = entry.id;
    } else if (!snapshot.focused && activeId === entry.id) {
      activeId = null;
    }

    applyPointerInteractivity(entry, activeId);

    if (previousSnapshot?.value !== snapshot.value) {
      entry.callbacks.onValueChange?.(snapshot);
    }

    if (
      previousSnapshot?.selectionStart !== snapshot.selectionStart ||
      previousSnapshot?.selectionEnd !== snapshot.selectionEnd ||
      previousSnapshot?.focused !== snapshot.focused ||
      previousSnapshot?.composing !== snapshot.composing
    ) {
      entry.callbacks.onSelectionChange?.(snapshot);
    }

    entry.lastSnapshot = snapshot;
  };

  const updateElementAttributes = (entry) => {
    const {
      debugVisible = false,
      disabled = false,
      readOnly = false,
      secure = false,
      multiline = false,
      maxLength,
      inputMode,
      enterKeyHint,
      tabIndex,
      textStyle,
      padding,
      placeholder = "",
      autocomplete = "off",
      autocapitalize = "off",
      spellcheck = false,
    } = entry.options;
    const { element } = entry;

    if (element instanceof HTMLInputElement) {
      element.type = secure ? "password" : "text";
    }

    element.disabled = disabled;
    element.readOnly = readOnly;
    element.placeholder = placeholder;
    element.autocomplete = autocomplete;
    element.autocapitalize = autocapitalize;
    element.spellcheck = Boolean(spellcheck);
    element.style.opacity = debugVisible ? "1" : DEFAULT_HIDDEN_OPACITY;
    element.style.color = debugVisible
      ? String(textStyle?.fill ?? "#000000")
      : "transparent";
    element.style.caretColor = debugVisible
      ? String(textStyle?.fill ?? "#000000")
      : "transparent";
    element.style.background = debugVisible
      ? "rgba(255,255,255,0.85)"
      : "transparent";
    element.style.paddingTop = `${padding.top}px`;
    element.style.paddingRight = `${padding.right}px`;
    element.style.paddingBottom = `${padding.bottom}px`;
    element.style.paddingLeft = `${padding.left}px`;
    element.style.fontFamily = textStyle?.fontFamily ?? "Arial";
    element.style.fontSize = `${textStyle?.fontSize ?? 16}px`;
    element.style.fontWeight = textStyle?.fontWeight ?? "400";
    element.style.textAlign = textStyle?.align ?? "left";
    element.style.lineHeight =
      typeof textStyle?.lineHeight === "number"
        ? `${textStyle.lineHeight}px`
        : "normal";
    element.style.whiteSpace = multiline ? "pre" : "nowrap";
    element.style.overflowWrap = "normal";
    element.style.resize = "none";
    element.style.overflow = "hidden";

    if (typeof maxLength === "number") {
      element.maxLength = maxLength;
    } else {
      element.removeAttribute("maxLength");
    }

    if (typeof inputMode === "string" && inputMode.length > 0) {
      element.inputMode = inputMode;
    } else {
      element.removeAttribute("inputmode");
    }

    if (typeof enterKeyHint === "string" && enterKeyHint.length > 0) {
      element.enterKeyHint = enterKeyHint;
    } else {
      element.removeAttribute("enterkeyhint");
    }

    if (typeof tabIndex === "number") {
      element.tabIndex = tabIndex;
    } else {
      element.tabIndex = disabled ? -1 : 0;
    }

    if (multiline && element instanceof HTMLTextAreaElement) {
      element.wrap = "off";
      element.rows = 1;
    }

    applyPointerInteractivity(entry, activeId);
  };

  const syncGeometry = (entry) => {
    ensureRoot();

    const canvas = app.canvas;
    const geometry = entry.options.getGeometry?.();

    if (!canvas || !geometry || geometry.visible === false) {
      entry.element.style.display = "none";
      return;
    }

    const canvasRect = canvas.getBoundingClientRect();
    const rendererWidth = app.renderer?.width || canvasRect.width || 1;
    const rendererHeight = app.renderer?.height || canvasRect.height || 1;
    const scaleX = canvasRect.width / rendererWidth;
    const scaleY = canvasRect.height / rendererHeight;
    const clipInsets = geometry.clipInsets ?? {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    };
    const scaledClipInsets = {
      top: clipInsets.top * scaleY,
      right: clipInsets.right * scaleX,
      bottom: clipInsets.bottom * scaleY,
      left: clipInsets.left * scaleX,
    };

    entry.element.style.display = "block";
    entry.element.style.left = `${canvasRect.left + geometry.x * scaleX}px`;
    entry.element.style.top = `${canvasRect.top + geometry.y * scaleY}px`;
    entry.element.style.width = `${geometry.width * scaleX}px`;
    entry.element.style.height = `${geometry.height * scaleY}px`;

    const hasClipInsets = Object.values(scaledClipInsets).some(
      (value) => value > 0,
    );

    entry.element.style.clipPath = hasClipInsets
      ? `inset(${scaledClipInsets.top}px ${scaledClipInsets.right}px ${scaledClipInsets.bottom}px ${scaledClipInsets.left}px)`
      : "none";
  };

  const onDocumentPointerDown = (event) => {
    if (!activeId) return;

    const activeEntry = entries.get(activeId);
    const target = event.target;

    if (!activeEntry || target === activeEntry.element) return;
    if (activeEntry.element.contains(target)) return;
    if (isTextControlTarget(target) && root?.contains(target)) return;
    if (isPointerWithinEntryGeometry({ app, entry: activeEntry, event })) {
      return;
    }

    activeEntry.element.blur();
  };

  const tick = () => {
    for (const entry of entries.values()) {
      syncGeometry(entry);

      if (!entry.lastSnapshot) {
        entry.lastSnapshot = getSnapshot(entry);
        continue;
      }

      const snapshot = getSnapshot(entry);

      if (!isSnapshotEqual(snapshot, entry.lastSnapshot)) {
        notifySnapshot(entry, entry.lastSnapshot);
      }
    }
  };

  const createControlElement = ({ id, options }) => {
    const element =
      options.multiline === true
        ? document.createElement("textarea")
        : document.createElement("input");

    element.dataset.routeGraphicsInputId = id;
    element.style.position = "fixed";
    element.style.border = "none";
    element.style.outline = "none";
    element.style.margin = "0";
    element.style.boxSizing = "border-box";
    element.style.borderRadius = "0";
    element.style.transformOrigin = "top left";
    element.style.appearance = "none";
    element.style.boxShadow = "none";
    element.style.userSelect = "none";
    element.style.webkitUserSelect = "none";

    return element;
  };

  const attachListeners = (entry) => {
    const { id, element } = entry;

    const syncFromDom = () => {
      notifySnapshot(entry);
    };

    element.addEventListener("focus", () => {
      activeId = id;
      applyPointerInteractivity(entry, activeId);
      const snapshot = getSnapshot(entry);
      entry.lastSnapshot = snapshot;
      entry.callbacks.onFocus?.(snapshot);
      entry.callbacks.onSelectionChange?.(snapshot);
    });

    element.addEventListener("blur", () => {
      const snapshot = getSnapshot(entry);
      if (activeId === id) {
        activeId = null;
      }
      applyPointerInteractivity(entry, activeId);
      entry.lastSnapshot = snapshot;
      entry.callbacks.onBlur?.(snapshot);
      entry.callbacks.onSelectionChange?.(snapshot);
    });

    element.addEventListener("input", syncFromDom);
    element.addEventListener("select", syncFromDom);
    element.addEventListener("click", () => queueMicrotask(syncFromDom));
    element.addEventListener("keyup", () => queueMicrotask(syncFromDom));
    element.addEventListener("keydown", (event) => {
      if (
        event.key === "Enter" &&
        entry.options.multiline !== true &&
        !event.shiftKey
      ) {
        entry.callbacks.onSubmit?.(getSnapshot(entry), event);
      }

      if (
        event.key === "Enter" &&
        entry.options.multiline === true &&
        (event.ctrlKey || event.metaKey)
      ) {
        entry.callbacks.onSubmit?.(getSnapshot(entry), event);
      }

      if (event.key === "Escape") {
        element.blur();
      }

      queueMicrotask(syncFromDom);
    });
    element.addEventListener("compositionstart", () => {
      entry.composing = true;
      const snapshot = getSnapshot(entry);
      entry.lastSnapshot = snapshot;
      entry.callbacks.onCompositionStart?.(snapshot);
      entry.callbacks.onSelectionChange?.(snapshot);
    });
    element.addEventListener("compositionupdate", () => {
      const snapshot = getSnapshot(entry);
      entry.lastSnapshot = snapshot;
      entry.callbacks.onCompositionUpdate?.(snapshot);
      entry.callbacks.onSelectionChange?.(snapshot);
    });
    element.addEventListener("compositionend", () => {
      entry.composing = false;
      syncFromDom();
      entry.callbacks.onCompositionEnd?.(getSnapshot(entry));
    });
  };

  document.addEventListener("pointerdown", onDocumentPointerDown, true);
  app.ticker?.add?.(tick);

  const mount = (id, options) => {
    ensureRoot();

    const existingEntry = entries.get(id);

    if (existingEntry) {
      existingEntry.options = options;
      existingEntry.callbacks = options.callbacks ?? {};
      updateElementAttributes(existingEntry);
      syncGeometry(existingEntry);
      if (
        typeof options.value === "string" &&
        existingEntry.element.value !== options.value
      ) {
        existingEntry.element.value = options.value;
      }
      existingEntry.lastSnapshot = getSnapshot(existingEntry);
      return existingEntry.element;
    }

    const entry = {
      id,
      element: createControlElement({ id, options }),
      options,
      callbacks: options.callbacks ?? {},
      composing: false,
      lastSnapshot: null,
    };

    attachListeners(entry);

    if (typeof options.value === "string") {
      entry.element.value = options.value;
    }

    updateElementAttributes(entry);
    root.appendChild(entry.element);
    entries.set(id, entry);
    syncGeometry(entry);
    entry.lastSnapshot = getSnapshot(entry);

    if (options.autofocus === true && !options.disabled) {
      queueMicrotask(() => {
        entry.element.focus();
        entry.element.select?.();
      });
    }

    return entry.element;
  };

  const update = (id, options) => {
    const entry = entries.get(id);

    if (!entry) {
      return mount(id, options);
    }

    const requiresReplacement =
      (options.multiline === true) !==
      entry.element instanceof HTMLTextAreaElement;

    entry.options = options;
    entry.callbacks = options.callbacks ?? {};

    if (requiresReplacement) {
      const previousElement = entry.element;
      const wasFocused = document.activeElement === previousElement;
      const previousSelectionStart = getSelectionValue(
        previousElement,
        "selectionStart",
      );
      const previousSelectionEnd = getSelectionValue(
        previousElement,
        "selectionEnd",
      );

      entry.element = createControlElement({ id, options });
      attachListeners(entry);
      previousElement.replaceWith(entry.element);
      entry.element.value =
        typeof options.value === "string"
          ? options.value
          : previousElement.value;
      updateElementAttributes(entry);
      syncGeometry(entry);
      entry.lastSnapshot = getSnapshot(entry);

      if (wasFocused && !options.disabled) {
        queueMicrotask(() => {
          entry.element.focus();
          setSelection(
            entry.element,
            previousSelectionStart,
            previousSelectionEnd,
          );
        });
      }

      return entry.element;
    }

    if (
      typeof options.value === "string" &&
      options.value !== entry.element.value &&
      entry.composing !== true
    ) {
      entry.element.value = options.value;
    }

    updateElementAttributes(entry);
    syncGeometry(entry);
    entry.lastSnapshot = getSnapshot(entry);

    return entry.element;
  };

  const focus = (
    id,
    { selectAll = false, selectionStart, selectionEnd } = {},
  ) => {
    const entry = entries.get(id);

    if (!entry || entry.element.disabled) return;

    setTimeout(() => {
      activeId = id;
      applyPointerInteractivity(entry, activeId);
      entry.element.focus();
      if (selectAll) {
        entry.element.select?.();
        return;
      }

      if (
        typeof selectionStart === "number" ||
        typeof selectionEnd === "number"
      ) {
        const start =
          typeof selectionStart === "number"
            ? selectionStart
            : getSelectionValue(entry.element, "selectionStart");
        const end =
          typeof selectionEnd === "number"
            ? selectionEnd
            : typeof selectionStart === "number"
              ? selectionStart
              : getSelectionValue(entry.element, "selectionEnd");

        setSelection(entry.element, start, end);
        notifySnapshot(entry, entry.lastSnapshot);
      }
    }, 0);
  };

  const updateSelection = (id, start, end = start, { focus = false } = {}) => {
    const entry = entries.get(id);

    if (!entry || entry.element.disabled) return;

    const applySelection = () => {
      setSelection(entry.element, start, end);
      notifySnapshot(entry, entry.lastSnapshot);
    };

    if (focus && document.activeElement !== entry.element) {
      entry.element.focus();
      queueMicrotask(applySelection);
      return;
    }

    applySelection();
  };

  const blur = (id) => {
    const entry = entries.get(id);

    entry?.element.blur();
  };

  const unmount = (id) => {
    const entry = entries.get(id);

    if (!entry) return;

    if (activeId === id) {
      activeId = null;
    }

    entry.element.remove();
    entries.delete(id);

    if (entries.size === 0) {
      root?.remove();
    }
  };

  const destroy = () => {
    document.removeEventListener("pointerdown", onDocumentPointerDown, true);
    app.ticker?.remove?.(tick);

    for (const entry of entries.values()) {
      entry.element.remove();
    }

    entries.clear();
    activeId = null;
    root?.remove();
    root = undefined;
  };

  return {
    mount,
    update,
    focus,
    setSelection: updateSelection,
    blur,
    unmount,
    destroy,
  };
};

export default createInputDomBridge;
