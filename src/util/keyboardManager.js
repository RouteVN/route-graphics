import hotkeys from "hotkeys-js";
import { isDeepEqual } from "./isDeepEqual.js";

const BINDING_DELIMITER = ",";
const TOKEN_DELIMITER = "+";

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

const getEventKeyCode = (event) => {
  if (typeof event?.code === "string" && /^Key[A-Z]$/.test(event.code)) {
    return event.code.charCodeAt(3);
  }

  const resolvedKeyCode = resolveKeyCode(event?.key ?? "");

  if (typeof resolvedKeyCode === "number") {
    return resolvedKeyCode;
  }

  if (typeof event?.which === "number" && event.which > 0) {
    return event.which;
  }

  if (typeof event?.keyCode === "number" && event.keyCode > 0) {
    return event.keyCode;
  }

  if (typeof event?.charCode === "number" && event.charCode > 0) {
    return event.charCode;
  }

  return null;
};

const getBindingReleaseCodes = (binding) => {
  const releaseCodes = new Set();

  if (typeof binding !== "string" || binding.length === 0) {
    return releaseCodes;
  }

  binding
    .replace(/\s/g, "")
    .split(BINDING_DELIMITER)
    .filter(Boolean)
    .forEach((shortcut) => {
      shortcut
        .split(TOKEN_DELIMITER)
        .map((token) => resolveKeyCode(token))
        .filter((keyCode) => typeof keyCode === "number")
        .forEach((keyCode) => {
          releaseCodes.add(keyCode);
        });
    });

  return releaseCodes;
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
  const bindingReleaseCodes = new Map();
  const activeKeyupBindings = new Set();

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
    activeKeyupBindings.clear();
  };

  const onDocumentKeyup = (event) => {
    const releasedKeyCode = getEventKeyCode(event);

    if (typeof releasedKeyCode !== "number") {
      return;
    }

    for (const binding of [...activeKeyupBindings]) {
      const releaseCodes = bindingReleaseCodes.get(binding);
      const config = registeredBindings.get(binding);

      if (!releaseCodes?.has(releasedKeyCode) || !config?.keyup) {
        continue;
      }

      activeKeyupBindings.delete(binding);
      emitKeyboardEvent("keyup", binding, config.keyup.payload);
    }
  };

  if (typeof document !== "undefined") {
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
      bindingReleaseCodes.delete(binding);
      activeKeyupBindings.delete(binding);
    });

    [...bindingsToAdd, ...bindingsToUpdate].forEach((binding) => {
      const config = nextHotkeys.get(binding);
      const releaseCodes = getBindingReleaseCodes(binding);

      activeKeyupBindings.delete(binding);
      bindingReleaseCodes.set(binding, releaseCodes);

      // hotkeys-js is reliable for combo activation, but not for combo release
      // when modifiers are released before the final non-modifier key.
      hotkeys(binding, () => {
        if (config.keyup) {
          activeKeyupBindings.add(binding);
        }

        if (config.keydown) {
          emitKeyboardEvent("keydown", binding, config.keydown.payload);
        }
      });

      registeredBindings.set(binding, config);
    });
  };

  const destroy = () => {
    if (typeof document !== "undefined") {
      document.removeEventListener("keyup", onDocumentKeyup);
    }

    if (typeof window !== "undefined") {
      window.removeEventListener("blur", clearActiveKeyupBindings);
    }

    for (const key of registeredBindings.keys()) {
      hotkeys.unbind(key);
    }
    registeredBindings.clear();
    bindingReleaseCodes.clear();
    activeKeyupBindings.clear();
  };

  return {
    registerHotkeys,
    destroy,
  };
};
