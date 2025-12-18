import hotkeys from "hotkeys-js";

/**
 * Create keyboard manager for handling global hotkeys
 * @param {Function} eventHandler - Event handler function from RouteGraphics
 * @returns {Object} Keyboard manager instance
 */
export const createKeyboardManager = (eventHandler) => {
  const activeHotkeys = new Set();

  /**
   * Register hotkeys with action payloads
   * @param {Object} hotkeyConfigs - Object with key mappings
   * @param {Object} hotkeyConfigs[key].actionPayload - Action payload for the key
   */
  const registerHotkeys = (hotkeyConfigs = {}) => {
    if (typeof hotkeyConfigs !== "object" || hotkeyConfigs === null) return;

    Object.entries(hotkeyConfigs).forEach(([key, config]) => {
      const handler = () => {
        if (eventHandler) {
          eventHandler("keydown", {
            _event: {
              key: key,
            },
            ...(config.actionPayload ?? {}),
          });
        }
      };

      hotkeys(key, handler);

      activeHotkeys.add(key);
    });
  };

  /**
   * Unregister all hotkeys
   */
  const unregisterAllHotkeys = () => {
    activeHotkeys.forEach((key) => {
      hotkeys.unbind(key);
    });
    activeHotkeys.clear();
  };

  return {
    registerHotkeys,
    unregisterAllHotkeys,
  };
};
