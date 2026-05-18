const readButton = (event) => {
  if (!event || typeof event !== "object") {
    return undefined;
  }

  if (typeof event.button === "number") {
    return event.button;
  }

  if (typeof event.data?.button === "number") {
    return event.data.button;
  }

  if (typeof event.nativeEvent?.button === "number") {
    return event.nativeEvent.button;
  }

  return undefined;
};

export const isPrimaryPointerEvent = (event) => {
  const button = readButton(event);
  return button === undefined || button === 0;
};

export const isSecondaryPointerEvent = (event) => {
  const button = readButton(event);
  return button === 2;
};
