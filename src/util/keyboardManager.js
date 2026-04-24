import hotkeys from "hotkeys-js";
import { isDeepEqual } from "./isDeepEqual.js";

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
  const activeHotkeys = new Map();

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
      const active = activeHotkeys.get(binding);
      if (!active) {
        bindingsToAdd.push(binding);
      } else if (!isDeepEqual(active, config)) {
        bindingsToUpdate.push(binding);
        hotkeys.unbind(binding);
      }
    });

    activeHotkeys.forEach((_, binding) => {
      if (!nextHotkeys.has(binding)) {
        bindingsToRemove.push(binding);
      }
    });

    bindingsToRemove.forEach((binding) => {
      hotkeys.unbind(binding);
      activeHotkeys.delete(binding);
    });

    [...bindingsToAdd, ...bindingsToUpdate].forEach((binding) => {
      const config = nextHotkeys.get(binding);

      Object.entries(config).forEach(([eventName, phaseConfig]) => {
        hotkeys(
          binding,
          {
            keydown: eventName === "keydown",
            keyup: eventName === "keyup",
          },
          () => {
            if (eventHandler) {
              eventHandler(eventName, {
                _event: {
                  key: binding,
                },
                ...phaseConfig.payload,
              });
            }
          },
        );
      });

      activeHotkeys.set(binding, config);
    });
  };

  const destroy = () => {
    for (const key of activeHotkeys.keys()) {
      hotkeys.unbind(key);
    }
    activeHotkeys.clear();
  };

  return {
    registerHotkeys,
    destroy,
  };
};
