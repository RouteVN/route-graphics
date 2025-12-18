import hotkeys from "hotkeys-js";

/**
 * Create keyboard manager for handling global hotkeys
 * @param {Function} eventHandler - Event handler function from RouteGraphics
 * @returns {Object} Keyboard manager instance
 */
export const createKeyboardManager = (eventHandler) => {
  const activeHotkeys = new Map();

  /**
   * @param {Object} hotkeyConfigs - Object with key mappings
   * @param {Object} hotkeyConfigs[key].actionPayload - Action payload for the key
   */
  const registerHotkeys = (hotkeyConfigs = {}) => {
    if (typeof hotkeyConfigs !== "object" || hotkeyConfigs === null) return;

    const keysToAdd = [];
    const keysToUpdate = [];
    const keysToRemove = [];

    Object.keys(hotkeyConfigs).forEach(key => {
      const active = activeHotkeys.get(key);
      if (!active) {
        keysToAdd.push(key);
      } else if (JSON.stringify(active.payload) !== JSON.stringify(hotkeyConfigs[key].actionPayload)) {
        keysToUpdate.push(key);
        hotkeys.unbind(key);
      }
    });

    activeHotkeys.forEach((_, key) => {
      if (!hotkeyConfigs.hasOwnProperty(key)) {
        keysToRemove.push(key);
      }
    });

    keysToRemove.forEach(key => {
      hotkeys.unbind(key);
      activeHotkeys.delete(key);
    });

    [...keysToAdd, ...keysToUpdate].forEach(key => {
      const config = hotkeyConfigs[key];
      const payload = config.actionPayload ?? {};

      const handler = () => {
        if (eventHandler) {
          eventHandler("keydown", {
            _event: {
              key: key,
            },
            ...payload,
          });
        }
      };

      hotkeys(key, handler);

      activeHotkeys.set(key, {
        value: key,
        payload: payload,
      });
    });
  };

  return {
    registerHotkeys,
  };
};
