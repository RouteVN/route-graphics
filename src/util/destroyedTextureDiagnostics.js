const MAX_LABELS = 5;

const hasDestroyedTexture = (node) => {
  const texture = node?.texture;
  if (!texture || typeof texture !== "object") {
    return false;
  }

  return (
    texture.destroyed === true ||
    texture.source === null ||
    texture.source?.destroyed === true
  );
};

/**
 * Labels of the display objects under `root` that still draw a texture or a
 * texture source that was destroyed.
 * @param {import("pixi.js").Container | undefined} root
 * @returns {string[]}
 */
export const findDestroyedTextureLabels = (root) => {
  const labels = [];
  const visit = (node) => {
    if (!node || labels.length >= MAX_LABELS) {
      return;
    }

    if (hasDestroyedTexture(node)) {
      labels.push(node.label || node.constructor?.name || "unlabelled");
    }
    for (const child of node.children ?? []) {
      visit(child);
    }
  };

  visit(root);
  return labels;
};

/**
 * A frame that fails on a destroyed texture, such as "null is not an object
 * (evaluating 'e.naturalWidth')", names none of the elements that draw it.
 * Adds their labels to the error before it is rethrown. Never throws, so it
 * cannot hide the original error.
 * @param {unknown} error
 * @param {import("pixi.js").Container | undefined} root
 */
export const describeDestroyedTextures = (error, root) => {
  try {
    if (
      !error ||
      typeof error !== "object" ||
      typeof error.message !== "string" ||
      error.destroyedTextureLabels !== undefined
    ) {
      return;
    }

    const labels = findDestroyedTextureLabels(root);
    if (labels.length === 0) {
      return;
    }

    error.destroyedTextureLabels = labels;
    error.message = `${error.message} [Route Graphics: destroyed texture on ${labels
      .map((label) => `"${label}"`)
      .join(", ")}]`;
  } catch {
    // Diagnostics only.
  }
};
