const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const mergeShadow = (baseShadow, overrideShadow) => {
  if (overrideShadow === undefined) return baseShadow;
  if (overrideShadow === null || overrideShadow === false) return null;

  if (isPlainObject(overrideShadow)) {
    return {
      ...(isPlainObject(baseShadow) ? baseShadow : {}),
      ...overrideShadow,
    };
  }

  return overrideShadow;
};

export const mergeTextStyle = (baseStyle = {}, overrideStyle = {}) => {
  if (!overrideStyle) return { ...baseStyle };

  const mergedStyle = {
    ...baseStyle,
    ...overrideStyle,
  };

  if (Object.prototype.hasOwnProperty.call(overrideStyle, "shadow")) {
    mergedStyle.shadow = mergeShadow(baseStyle?.shadow, overrideStyle.shadow);
  }

  return mergedStyle;
};
