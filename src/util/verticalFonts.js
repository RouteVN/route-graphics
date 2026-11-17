// Vertical glyph forms (OpenType `vert`) cannot be requested per draw call on
// a canvas: the 2D context always resets font-feature-settings. A font face
// can carry the feature itself though, so every loaded font gets a second
// face with `vert` switched on, and vertical text draws its upright glyphs
// with that face.

export const VERTICAL_FONT_FAMILY_SUFFIX = "__vertical";

// Characters whose vertical form differs visibly from the horizontal one in
// any font that implements `vert`.
const VERTICAL_GLYPH_PROBE_TEXT = "ー、「";
const VERTICAL_GLYPH_PROBE_FONT_SIZE = 32;

const verticalFontFamilies = new Set();
const verticalGlyphCache = new Map();

const normalizeFamilyName = (family) =>
  String(family ?? "")
    .trim()
    .replace(/^["']|["']$/g, "");

export const getVerticalFontFamilyName = (family) =>
  `${normalizeFamilyName(family)}${VERTICAL_FONT_FAMILY_SUFFIX}`;

export const registerVerticalFontFamily = (family) => {
  verticalFontFamilies.add(normalizeFamilyName(family));
};

export const unregisterVerticalFontFamily = (family) => {
  const name = normalizeFamilyName(family);

  verticalFontFamilies.delete(name);
  verticalGlyphCache.delete(name);
};

export const hasVerticalFontFamily = (family) =>
  verticalFontFamilies.has(normalizeFamilyName(family));

const splitFamilies = (fontFamily) =>
  Array.isArray(fontFamily)
    ? fontFamily
    : String(fontFamily ?? "")
        .split(",")
        .map((family) => family.trim())
        .filter((family) => family.length > 0);

/**
 * Resolve the font family to draw upright vertical glyphs with.
 * Returns null when the primary family has no vertical face, in which case
 * the caller falls back to rotating and shifting horizontal glyphs.
 * @param {string | string[]} fontFamily
 * @returns {string | string[] | null}
 */
export const resolveVerticalFontFamily = (fontFamily) => {
  const families = splitFamilies(fontFamily);

  if (families.length === 0 || !hasVerticalFontFamily(families[0])) {
    return null;
  }

  const resolved = families.map((family) =>
    hasVerticalFontFamily(family) ? getVerticalFontFamilyName(family) : family,
  );

  return Array.isArray(fontFamily) || resolved.length > 1
    ? resolved
    : resolved[0];
};

const renderProbe = (family, text) => {
  const size = VERTICAL_GLYPH_PROBE_FONT_SIZE;
  const canvas = document.createElement("canvas");

  canvas.width = size * ([...text].length + 1);
  canvas.height = size * 2;

  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) return null;

  context.font = `${size}px "${family}"`;
  context.textBaseline = "alphabetic";
  context.fillStyle = "#000000";
  context.fillText(text, size / 2, size * 1.5);

  return context.getImageData(0, 0, canvas.width, canvas.height).data;
};

/**
 * True when drawing with the vertical face really produces different glyphs.
 * It is false when the engine ignores the face descriptor or when the font
 * has no vertical alternates.
 */
export const detectVerticalGlyphs = (
  family,
  verticalFamily,
  text = VERTICAL_GLYPH_PROBE_TEXT,
) => {
  try {
    if (typeof document === "undefined") return false;

    const horizontal = renderProbe(family, text);
    const vertical = renderProbe(verticalFamily, text);

    if (!horizontal || !vertical || horizontal.length !== vertical.length) {
      return false;
    }

    for (let index = 3; index < vertical.length; index += 4) {
      if (vertical[index] !== horizontal[index]) return true;
    }

    return false;
  } catch {
    return false;
  }
};

/**
 * Whether the vertical face of a font draws `character` differently from the
 * regular face. Fonts only carry vertical alternates for some characters;
 * the rest need the rotate/shift fallback even when a vertical face exists.
 * @param {string | string[]} fontFamily
 * @param {string} character
 */
export const hasVerticalGlyph = (fontFamily, character) => {
  const family = normalizeFamilyName(splitFamilies(fontFamily)[0]);

  if (!verticalFontFamilies.has(family)) return false;

  let glyphs = verticalGlyphCache.get(family);

  if (!glyphs) {
    glyphs = new Map();
    verticalGlyphCache.set(family, glyphs);
  }

  if (!glyphs.has(character)) {
    glyphs.set(
      character,
      detectVerticalGlyphs(
        family,
        getVerticalFontFamilyName(family),
        character,
      ),
    );
  }

  return glyphs.get(character);
};

/**
 * Load a second face of a font with the OpenType `vert` feature enabled and
 * register it when it really yields vertical glyphs.
 * @param {Object} params
 * @param {string} params.family - Family name of the already loaded font
 * @param {string} params.source - FontFace source, e.g. `url(blob:...)`
 * @returns {Promise<FontFace | null>} The added face, or null when unusable
 */
export const loadVerticalFontFace = async ({ family, source }) => {
  if (typeof FontFace !== "function" || typeof document === "undefined") {
    return null;
  }

  const verticalFamily = getVerticalFontFamilyName(family);
  let fontFace;

  try {
    fontFace = new FontFace(verticalFamily, source, {
      featureSettings: '"vert" 1',
    });
    await fontFace.load();
    document.fonts.add(fontFace);
  } catch {
    return null;
  }

  if (!detectVerticalGlyphs(family, verticalFamily)) {
    document.fonts.delete(fontFace);
    return null;
  }

  registerVerticalFontFamily(family);

  return fontFace;
};
