const MAX_LABELS = 5;

const hasReleasedTexture = (node) => {
  const texture = node?.texture;
  if (!texture || typeof texture !== "object") {
    return false;
  }

  return (
    texture.destroyed === true ||
    texture.source === null ||
    texture.source?.destroyed === true ||
    // Pixi sets it to null when it destroys a source and when it returns a
    // texture to a pool, and a live frame cannot upload such a source.
    texture.source?.resource === null
  );
};

/**
 * Labels of the display objects under `root` that still draw a texture or a
 * texture source that was destroyed or released, so it has no image left.
 * @param {import("pixi.js").Container | undefined} root
 * @returns {string[]}
 */
export const findReleasedTextureLabels = (root) => {
  const labels = [];
  const visit = (node) => {
    if (!node || labels.length >= MAX_LABELS) {
      return;
    }

    if (hasReleasedTexture(node)) {
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
 * A frame that fails on a released texture, such as "null is not an object
 * (evaluating 'e.naturalWidth')", names none of the elements that draw it.
 * Adds their labels to the error before it is rethrown. Never throws, so it
 * cannot hide the original error.
 * @param {unknown} error
 * @param {import("pixi.js").Container | undefined} root
 */
export const describeReleasedTextures = (error, root) => {
  try {
    if (
      !error ||
      typeof error !== "object" ||
      typeof error.message !== "string" ||
      error.releasedTextureLabels !== undefined
    ) {
      return;
    }

    const labels = findReleasedTextureLabels(root);
    if (labels.length === 0) {
      return;
    }

    error.releasedTextureLabels = labels;
    error.message = `${error.message} [Route Graphics: released texture on ${labels
      .map((label) => `"${label}"`)
      .join(", ")}]`;
  } catch {
    // Diagnostics only.
  }
};
