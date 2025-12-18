/**
 * Asset buffer manager for caching loaded assets
 */
const createAssetBufferManager = () => {
  const cache = new Map();

  /**
   * Load assets from URLs with caching
   * @param {Object} assets - Map of asset keys to {url, type} objects
   * @returns {Promise<void>} Promise that resolves when all assets are loaded
   */
  const load = async (assets) => {
    const toFetch = [];

    // Check what needs to be fetched
    for (const [key, value] of Object.entries(assets)) {
      if (!cache.has(key)) {
        toFetch.push([key, value]);
      }
    }

    // Fetch uncached assets
    if (toFetch.length > 0) {
      await Promise.all(
        toFetch.map(async ([key, value]) => {
          const resp = await fetch(value.url);
          const buffer = await resp.arrayBuffer();
          const bufferData = {
            buffer,
            type: value.type,
          };

          // Cache the result
          cache.set(key, bufferData);
        }),
      );
    }
  };

  /**
   * Get the complete buffer map
   * @returns {Object<string, {buffer: ArrayBuffer, type: string}>} Buffer map with all loaded assets - keys map to objects with {buffer: ArrayBuffer, type: string}
   */
  const getBufferMap = () => {
    const bufferMap = {};
    for (const [key, value] of cache.entries()) {
      bufferMap[key] = value;
    }
    console.log('AssetBufferManager bufferMap:', bufferMap);
    return bufferMap;
  };

  /**
   * Clear the cache
   */
  const clear = () => cache.clear();

  /**
   * Get cache size
   */
  const size = () => cache.size;

  /**
   * Check if an asset is cached
   */
  const has = (key) => cache.has(key);

  return {
    load,
    getBufferMap,
    clear,
    size,
    has,
  };
};

export { createAssetBufferManager };
