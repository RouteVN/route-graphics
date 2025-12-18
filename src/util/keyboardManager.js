import hotkeys from "hotkeys-js";

/**
 * Create keyboard manager for handling global hotkeys
 * @param {Function} eventHandler - Event handler function from RouteGraphics
 * @returns {Object} Keyboard manager instance
 */
export const createKeyboardManager = (eventHandler) => {
  const activeHotkeys = new Map();

  /**
   * Register hotkeys with action payloads
   * @param {Array} hotkeyConfigs - Array of hotkey configurations
   * @param {string} hotkeyConfigs[].keys - Key combinations (e.g., 'a,b,c, ctrl+a')
   * @param {Object} hotkeyConfigs[].actionPayload - Action payload for the event
   */
  const registerHotkeys = (hotkeyConfigs = []) => {
    if (!Array.isArray(hotkeyConfigs)) return;

    hotkeyConfigs.forEach((config, index) => {
      const handler = (_, handler) => {
        if (eventHandler) {
          eventHandler("keydown", {
            _event: {
              key: handler.key,
            },
            ...(config.actionPayload ?? {}),
          });
        }
      };

      hotkeys(config.keys, handler);

      activeHotkeys.set(hotkeyId, {
        keys: config.keys,
        handler,
      });
    });
  };

  /**
   * Unregister all hotkeys
   */
  const unregisterAllHotkeys = () => {
    activeHotkeys.forEach(({ keys }) => {
      hotkeys.unbind(keys);
    });
    activeHotkeys.clear();
  };

  return {
    registerHotkeys,
    unregisterAllHotkeys,
  };
};