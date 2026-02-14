import { cloneSerializableData } from "./cloneSerializableData.js";

export const sanitizePayloadForEvent = (payload = {}) =>
  cloneSerializableData(payload);

export const createStageEventPayload = (eventType, event) => {
  const native = event?.nativeEvent ?? {};
  const global = event?.global ?? {};

  return {
    type: eventType,
    id: event?.target?.label,
    currentId: event?.currentTarget?.label,
    pointerType: event?.pointerType,
    button: event?.button,
    buttons: event?.buttons,
    x: global.x,
    y: global.y,
    deltaX: event?.deltaX,
    deltaY: event?.deltaY,
    key: native.key,
    code: native.code,
    ctrlKey: native.ctrlKey,
    shiftKey: native.shiftKey,
    altKey: native.altKey,
    metaKey: native.metaKey,
  };
};

export const createSafeEventHandler = (eventHandler) => {
  if (typeof eventHandler !== "function") return undefined;

  return (eventName, payload = {}) => {
    eventHandler(eventName, cloneSerializableData(payload));
  };
};

export default createSafeEventHandler;
