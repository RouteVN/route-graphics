import hotkeys from "hotkeys-js";
import { isDeepEqual } from "./isDeepEqual.js";

const BINDING_DELIMITER = ",";
const TOKEN_DELIMITER = "+";
const MODIFIER_META_KEY_CODES = new Set([93, 224]);
const SHORTCUT_ACTIVATION_KEY_DELIMITER = "\u0000";

const isPlainObject = (value) => {
  return value !== null && typeof value === "object" && !Array.isArray(value);
};

const normalizePhaseConfig = (config) => {
  if (!isPlainObject(config)) {
    return null;
  }

  return {
    payload: isPlainObject(config.payload) ? config.payload : {},
  };
};

const resolveKeyCode = (token) => {
  if (typeof token !== "string" || token.length === 0) {
    return null;
  }

  const normalizedToken = token.toLowerCase();

  if (typeof hotkeys.modifier?.[normalizedToken] === "number") {
    return hotkeys.modifier[normalizedToken];
  }

  if (typeof hotkeys.keyMap?.[normalizedToken] === "number") {
    return hotkeys.keyMap[normalizedToken];
  }

  if (token.length === 1) {
    return token.toUpperCase().charCodeAt(0);
  }

  return null;
};

const normalizeKeyCode = (keyCode) => {
  return MODIFIER_META_KEY_CODES.has(keyCode) ? 91 : keyCode;
};

const getEventKeyCode = (event) => {
  let keyCode = null;

  if (typeof event?.keyCode === "number" && event.keyCode > 0) {
    keyCode = event.keyCode;
  } else if (typeof event?.which === "number" && event.which > 0) {
    keyCode = event.which;
  } else if (typeof event?.charCode === "number" && event.charCode > 0) {
    keyCode = event.charCode;
  }

  if (typeof event?.code === "string" && /^Key[A-Z]$/.test(event.code)) {
    keyCode = event.code.charCodeAt(3);
  }

  if (typeof keyCode === "number") {
    return normalizeKeyCode(keyCode);
  }

  return resolveKeyCode(event?.key ?? "");
};

const splitBindingShortcuts = (binding) => {
  if (typeof binding !== "string" || binding.length === 0) {
    return [];
  }

  const shortcuts = binding.replace(/\s/g, "").split(BINDING_DELIMITER);
  let emptyShortcutIndex = shortcuts.lastIndexOf("");

  while (emptyShortcutIndex >= 0) {
    if (emptyShortcutIndex > 0) {
      shortcuts[emptyShortcutIndex - 1] += BINDING_DELIMITER;
    }

    shortcuts.splice(emptyShortcutIndex, 1);
    emptyShortcutIndex = shortcuts.lastIndexOf("");
  }

  return shortcuts.filter(Boolean);
};

const isModifierKeyCode = (keyCode) => {
  return typeof hotkeys.modifierMap?.[keyCode] === "string";
};

const parseBindingShortcuts = (binding) => {
  return splitBindingShortcuts(binding)
    .map((shortcut) => {
      const releaseCodes = new Set(
        shortcut
          .split(TOKEN_DELIMITER)
          .map((token) => resolveKeyCode(token))
          .filter((keyCode) => typeof keyCode === "number")
          .map((keyCode) => normalizeKeyCode(keyCode)),
      );

      if (releaseCodes.size === 0) {
        return null;
      }

      return {
        shortcut,
        releaseCodes,
        isModifierOnly: [...releaseCodes].every(isModifierKeyCode),
      };
    })
    .filter(Boolean);
};

const hasAllCodes = (pressedKeyCodes, releaseCodes) => {
  for (const keyCode of releaseCodes) {
    if (!pressedKeyCodes.has(keyCode)) {
      return false;
    }
  }

  return true;
};

const getShortcutActivationKey = (binding, shortcut) => {
  return `${binding}${SHORTCUT_ACTIVATION_KEY_DELIMITER}${shortcut.shortcut}`;
};

const shouldHandleKeydown = (event) => {
  return typeof hotkeys.filter !== "function" || hotkeys.filter(event);
};

const normalizeBindingConfig = (config) => {
  if (!isPlainObject(config)) {
    return null;
  }

  const normalizedConfig = {};
  const keydown = normalizePhaseConfig(config.keydown);
  const keyup = normalizePhaseConfig(config.keyup);

  if (keydown) {
    normalizedConfig.keydown = keydown;
  }

  if (keyup) {
    normalizedConfig.keyup = keyup;
  }

  return Object.keys(normalizedConfig).length > 0 ? normalizedConfig : null;
};

/**
 * Create keyboard manager for handling global hotkeys
 * @param {Function} eventHandler - Event handler function from RouteGraphics
 * @returns {Object} Keyboard manager instance
 */
export const createKeyboardManager = (eventHandler) => {
  const registeredBindings = new Map();
  const bindingShortcuts = new Map();
  const activeKeyupShortcuts = new Map();
  const activeModifierShortcuts = new Map();
  const pressedKeyCodes = new Set();

  const emitKeyboardEvent = (eventName, binding, payload) => {
    if (!eventHandler) {
      return;
    }

    eventHandler(eventName, {
      _event: {
        key: binding,
      },
      ...payload,
    });
  };

  const clearActiveKeyupBindings = () => {
    activeKeyupShortcuts.clear();
    activeModifierShortcuts.clear();
    pressedKeyCodes.clear();
  };

  const clearBindingState = (binding) => {
    for (const [activationKey, activeShortcut] of [...activeKeyupShortcuts]) {
      if (activeShortcut.binding === binding) {
        activeKeyupShortcuts.delete(activationKey);
      }
    }

    for (const [activationKey, activeShortcut] of [
      ...activeModifierShortcuts,
    ]) {
      if (activeShortcut.binding === binding) {
        activeModifierShortcuts.delete(activationKey);
      }
    }

    bindingShortcuts.delete(binding);
  };

  const getHandlerShortcut = (binding, handler) => {
    const shortcuts = bindingShortcuts.get(binding) ?? [];
    const shortcutName =
      typeof handler?.shortcut === "string"
        ? handler.shortcut
        : typeof handler?.key === "string"
          ? handler.key
          : null;

    return (
      shortcuts.find((shortcut) => shortcut.shortcut === shortcutName) ??
      shortcuts[0] ??
      null
    );
  };

  const activateKeyupShortcut = (binding, shortcut) => {
    const config = registeredBindings.get(binding);

    if (!config?.keyup || !shortcut) {
      return;
    }

    activeKeyupShortcuts.set(getShortcutActivationKey(binding, shortcut), {
      binding,
      releaseCodes: new Set(shortcut.releaseCodes),
    });
  };

  const activateModifierShortcut = (binding, shortcut) => {
    const activationKey = getShortcutActivationKey(binding, shortcut);
    const wasActive = activeModifierShortcuts.has(activationKey);

    activeModifierShortcuts.set(activationKey, {
      binding,
      releaseCodes: new Set(shortcut.releaseCodes),
    });

    return wasActive;
  };

  const onDocumentKeydown = (event) => {
    if (!shouldHandleKeydown(event)) {
      return;
    }

    const pressedKeyCode = getEventKeyCode(event);

    if (typeof pressedKeyCode !== "number") {
      return;
    }

    pressedKeyCodes.add(pressedKeyCode);

    for (const [binding, config] of registeredBindings) {
      const shortcuts = bindingShortcuts.get(binding) ?? [];

      shortcuts
        .filter((shortcut) => shortcut.isModifierOnly)
        .forEach((shortcut) => {
          if (!hasAllCodes(pressedKeyCodes, shortcut.releaseCodes)) {
            return;
          }

          const wasActive = activateModifierShortcut(binding, shortcut);
          activateKeyupShortcut(binding, shortcut);

          if (config.keydown && !wasActive) {
            emitKeyboardEvent("keydown", binding, config.keydown.payload);
          }
        });
    }
  };

  const onDocumentKeyup = (event) => {
    const releasedKeyCode = getEventKeyCode(event);

    if (typeof releasedKeyCode !== "number") {
      return;
    }

    for (const [activationKey, activeShortcut] of [...activeKeyupShortcuts]) {
      const config = registeredBindings.get(activeShortcut.binding);

      if (!activeShortcut.releaseCodes.has(releasedKeyCode) || !config?.keyup) {
        continue;
      }

      activeKeyupShortcuts.delete(activationKey);
      emitKeyboardEvent("keyup", activeShortcut.binding, config.keyup.payload);
    }

    for (const [activationKey, activeShortcut] of [
      ...activeModifierShortcuts,
    ]) {
      if (activeShortcut.releaseCodes.has(releasedKeyCode)) {
        activeModifierShortcuts.delete(activationKey);
      }
    }

    pressedKeyCodes.delete(releasedKeyCode);
  };

  if (typeof document !== "undefined") {
    document.addEventListener("keydown", onDocumentKeydown);
    document.addEventListener("keyup", onDocumentKeyup);
  }

  if (typeof window !== "undefined") {
    window.addEventListener("blur", clearActiveKeyupBindings);
  }

  /**
   * @param {Object} hotkeyConfigs - Object with key mappings
   * @param {Object} hotkeyConfigs[key].keydown - Keydown event configuration for the key
   * @param {Object} hotkeyConfigs[key].keyup - Keyup event configuration for the key
   */
  const registerHotkeys = (hotkeyConfigs = {}) => {
    if (typeof hotkeyConfigs !== "object" || hotkeyConfigs === null) return;

    const nextHotkeys = new Map();
    const bindingsToAdd = [];
    const bindingsToUpdate = [];
    const bindingsToRemove = [];

    Object.keys(hotkeyConfigs).forEach((binding) => {
      const normalizedConfig = normalizeBindingConfig(hotkeyConfigs[binding]);

      if (normalizedConfig) {
        nextHotkeys.set(binding, normalizedConfig);
      }
    });

    nextHotkeys.forEach((config, binding) => {
      const active = registeredBindings.get(binding);
      if (!active) {
        bindingsToAdd.push(binding);
      } else if (!isDeepEqual(active, config)) {
        bindingsToUpdate.push(binding);
        hotkeys.unbind(binding);
      }
    });

    registeredBindings.forEach((_, binding) => {
      if (!nextHotkeys.has(binding)) {
        bindingsToRemove.push(binding);
      }
    });

    bindingsToRemove.forEach((binding) => {
      hotkeys.unbind(binding);
      registeredBindings.delete(binding);
      clearBindingState(binding);
    });

    [...bindingsToAdd, ...bindingsToUpdate].forEach((binding) => {
      const config = nextHotkeys.get(binding);
      const shortcuts = parseBindingShortcuts(binding);

      clearBindingState(binding);
      bindingShortcuts.set(binding, shortcuts);
      registeredBindings.set(binding, config);

      // hotkeys-js is reliable for combo activation, but not for combo release
      // when modifiers are released before the final non-modifier key.
      hotkeys(binding, (_event, handler) => {
        const shortcut = getHandlerShortcut(binding, handler);

        if (shortcut?.isModifierOnly) {
          const wasActive = activateModifierShortcut(binding, shortcut);

          activateKeyupShortcut(binding, shortcut);

          if (config.keydown && !wasActive) {
            emitKeyboardEvent("keydown", binding, config.keydown.payload);
          }

          return;
        }

        activateKeyupShortcut(binding, shortcut);

        if (config.keydown) {
          emitKeyboardEvent("keydown", binding, config.keydown.payload);
        }
      });
    });
  };

  const destroy = () => {
    if (typeof document !== "undefined") {
      document.removeEventListener("keydown", onDocumentKeydown);
      document.removeEventListener("keyup", onDocumentKeyup);
    }

    if (typeof window !== "undefined") {
      window.removeEventListener("blur", clearActiveKeyupBindings);
    }

    for (const key of registeredBindings.keys()) {
      hotkeys.unbind(key);
    }
    registeredBindings.clear();
    bindingShortcuts.clear();
    activeKeyupShortcuts.clear();
    activeModifierShortcuts.clear();
    pressedKeyCodes.clear();
  };

  return {
    registerHotkeys,
    destroy,
  };
};
